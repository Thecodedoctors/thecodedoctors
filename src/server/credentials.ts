"use server";

import { db, credentialRequests, clients, users } from "@/db";
import { eq, desc, and, isNull, isNotNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireUser,
  requireStaff,
  requireFounder,
} from "@/lib/auth-helpers";
import { getOrCreateClientForUser, userBelongsToClient } from "@/lib/clients";
import {
  encryptCredentialPayload,
  decryptCredentialPayload,
  isCredentialCryptoConfigured,
} from "@/lib/credential-crypto";
import { sendBrandEmail } from "@/lib/email";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";

/**
 * Doctor-requested credentials.
 *
 * Read side is founder-only by deliberate choice — the user said
 * "only me, the founder can see these information." Other staff can
 * create / close requests but can't read the plaintext bundle.
 *
 * Encryption key lives in `CREDENTIAL_ENCRYPTION_KEY` (32 bytes, base64).
 * If unset, the create + view paths refuse to operate so we never
 * silently store creds in plaintext or pretend a missing key is fine.
 */

const ALLOWED_FIELD_KINDS = new Set([
  "text",
  "password",
  "url",
  "multiline",
  "api_key",
]);
const MAX_FIELDS_PER_REQUEST = 12;
const MAX_FIELD_VALUE = 5_000;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1_000;
const MAX_NOTE = 500;

export type FieldKind = "text" | "password" | "url" | "multiline" | "api_key";

export type FieldSchema = {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  placeholder?: string;
};

export type RequestState = "open" | "submitted" | "closed";

export type RequestSummary = {
  id: string;
  title: string;
  description: string | null;
  state: RequestState;
  fieldsSchema: FieldSchema[];
  requestedByName: string | null;
  submittedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
};

/* ──────────────────────────────────────────────────────────────────────────
   Patient surface
   ──────────────────────────────────────────────────────────────────────── */

export async function listCredentialRequestsForCurrentUser(): Promise<
  RequestSummary[]
> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  const rows = await db()
    .select({
      id: credentialRequests.id,
      title: credentialRequests.title,
      description: credentialRequests.description,
      fieldsSchema: credentialRequests.fieldsSchema,
      submittedAt: credentialRequests.submittedAt,
      closedAt: credentialRequests.closedAt,
      createdAt: credentialRequests.createdAt,
      requestedByName: users.name,
    })
    .from(credentialRequests)
    .leftJoin(users, eq(users.id, credentialRequests.requestedByUserId))
    .where(eq(credentialRequests.clientId, client.id))
    .orderBy(desc(credentialRequests.createdAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    state: stateOf(r.submittedAt, r.closedAt),
    fieldsSchema: parseFieldsSchema(r.fieldsSchema),
    requestedByName: r.requestedByName,
    submittedAt: r.submittedAt ? new Date(r.submittedAt) : null,
    closedAt: r.closedAt ? new Date(r.closedAt) : null,
    createdAt: new Date(r.createdAt),
  }));
}

/** Patient-side detail for the submission form. NEVER returns the
 *  encrypted blob or any plaintext values, even after submission. */
export async function getCredentialRequestForCurrentUser(
  id: string
): Promise<RequestSummary | null> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  const rows = await db()
    .select({
      id: credentialRequests.id,
      clientId: credentialRequests.clientId,
      title: credentialRequests.title,
      description: credentialRequests.description,
      fieldsSchema: credentialRequests.fieldsSchema,
      submittedAt: credentialRequests.submittedAt,
      closedAt: credentialRequests.closedAt,
      createdAt: credentialRequests.createdAt,
      requestedByName: users.name,
    })
    .from(credentialRequests)
    .leftJoin(users, eq(users.id, credentialRequests.requestedByUserId))
    .where(eq(credentialRequests.id, id))
    .limit(1);
  const r = rows[0];
  if (!r || r.clientId !== client.id) return null;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    state: stateOf(r.submittedAt, r.closedAt),
    fieldsSchema: parseFieldsSchema(r.fieldsSchema),
    requestedByName: r.requestedByName,
    submittedAt: r.submittedAt ? new Date(r.submittedAt) : null,
    closedAt: r.closedAt ? new Date(r.closedAt) : null,
    createdAt: new Date(r.createdAt),
  };
}

/** Patient submits values. Encrypts + stores; emails the founder. */
export async function submitCredentialRequest(
  formData: FormData
): Promise<void> {
  const session = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return;

  const rows = await db()
    .select()
    .from(credentialRequests)
    .where(eq(credentialRequests.id, requestId))
    .limit(1);
  const cred = rows[0];
  if (!cred) return;

  const allowed = await userBelongsToClient(session.user.id, cred.clientId);
  if (!allowed) return;
  if (cred.submittedAt || cred.closedAt) return; // already submitted / closed

  if (!isCredentialCryptoConfigured()) {
    throw new Error(
      "Credential encryption isn't configured on the server. Tell the practice."
    );
  }

  const fields = parseFieldsSchema(cred.fieldsSchema);
  const payload: Record<string, string> = {};
  for (const f of fields) {
    const v = String(formData.get(f.key) ?? "").slice(0, MAX_FIELD_VALUE);
    if (f.required && !v.trim()) return; // form should have caught it
    payload[f.key] = v;
  }

  const { encrypted, version } = await encryptCredentialPayload(payload);

  await db()
    .update(credentialRequests)
    .set({
      encryptedSubmission: encrypted,
      encryptionVersion: version,
      submittedAt: new Date(),
      submittedByUserId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(credentialRequests.id, requestId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "credential.submitted",
    targetType: "credential_request",
    targetId: requestId,
  });

  // Notify the requester (and the founder address as a fallback).
  await notifyOnSubmission(cred);

  revalidatePath("/dashboard/credentials");
  revalidatePath(`/dashboard/credentials/${requestId}`);
  revalidatePath(`/admin/clients/${cred.clientId}`);
  revalidatePath(`/admin/credentials/${requestId}`);

  redirect(`/dashboard/credentials/${requestId}?submitted=1`);
}

/* ──────────────────────────────────────────────────────────────────────────
   Staff surface — create + close (any staff)
   ──────────────────────────────────────────────────────────────────────── */

/** Form action — staff creates a new request for a patient. */
export async function createCredentialRequest(
  formData: FormData
): Promise<void> {
  const session = await requireStaff();
  if (!isCredentialCryptoConfigured()) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is missing on the worker. Set it before creating requests."
    );
  }

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_TITLE);
  if (!title) return;
  const description =
    String(formData.get("description") ?? "").slice(0, MAX_DESCRIPTION) || null;

  // Field schema arrives as parallel arrays from the form: keys, labels,
  // kinds, required (each repeated). We zip them up to the structured
  // FieldSchema array, capped at MAX_FIELDS_PER_REQUEST.
  const labels = formData.getAll("fieldLabels").map(String);
  const kindsRaw = formData.getAll("fieldKinds").map(String);
  const requiredRaw = formData.getAll("fieldRequired").map(String);

  const fields: FieldSchema[] = [];
  for (let i = 0; i < labels.length && fields.length < MAX_FIELDS_PER_REQUEST; i++) {
    const label = labels[i].trim().slice(0, 80);
    if (!label) continue;
    const kindRaw = kindsRaw[i] ?? "text";
    const kind = (ALLOWED_FIELD_KINDS.has(kindRaw)
      ? kindRaw
      : "text") as FieldKind;
    const required = requiredRaw[i] === "true" || requiredRaw[i] === "on";
    fields.push({
      key: slugify(label) || `field_${i}`,
      label,
      kind,
      required,
    });
  }

  // Always include at least one field — falls back to a single text
  // input if the doctor forgot.
  if (fields.length === 0) {
    fields.push({ key: "value", label: "Value", kind: "text", required: true });
  }

  const id = crypto.randomUUID();
  await db().insert(credentialRequests).values({
    id,
    clientId,
    requestedByUserId: session.user.id,
    title,
    description,
    fieldsSchema: JSON.stringify(fields),
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "credential.request_created",
    targetType: "credential_request",
    targetId: id,
    after: { clientId, title, fieldCount: fields.length },
  });

  await notifyPatientOfNewRequest({ clientId, title });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/credentials");

  redirect(`/admin/credentials/${id}`);
}

/** Form action — founder closes a request, wiping the encrypted blob.
 *  Founder-only because closing is the only way to delete a submission
 *  before the founder reads it; we don't want a doctor doing that
 *  while the founder is away. */
export async function closeCredentialRequest(formData: FormData): Promise<void> {
  const session = await requireFounder();
  const requestId = String(formData.get("requestId") ?? "");
  const note = String(formData.get("closeNote") ?? "").slice(0, MAX_NOTE) || null;
  if (!requestId) return;

  const rows = await db()
    .select({ clientId: credentialRequests.clientId })
    .from(credentialRequests)
    .where(eq(credentialRequests.id, requestId))
    .limit(1);
  if (rows.length === 0) return;
  const clientId = rows[0].clientId;

  await db()
    .update(credentialRequests)
    .set({
      closedAt: new Date(),
      closedByUserId: session.user.id,
      closeNote: note,
      // Wipe the secret. Metadata + audit history stay.
      encryptedSubmission: null,
      encryptionVersion: null,
      updatedAt: new Date(),
    })
    .where(eq(credentialRequests.id, requestId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "credential.closed",
    targetType: "credential_request",
    targetId: requestId,
    after: { note },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/credentials");
  revalidatePath(`/admin/credentials/${requestId}`);
  revalidatePath("/dashboard/credentials");
  revalidatePath(`/dashboard/credentials/${requestId}`);
}

/* ──────────────────────────────────────────────────────────────────────────
   Staff list — any staff can browse requests across patients
   ──────────────────────────────────────────────────────────────────────── */

export type StaffRequestRow = RequestSummary & {
  clientId: string;
  clientName: string;
  hasSubmission: boolean;
};

export async function listCredentialRequestsForStaff(opts?: {
  clientId?: string;
  state?: "all" | "open" | "submitted" | "closed";
}): Promise<StaffRequestRow[]> {
  await requireStaff();
  const filters = [];
  if (opts?.clientId) filters.push(eq(credentialRequests.clientId, opts.clientId));
  if (opts?.state === "open") {
    filters.push(
      and(isNull(credentialRequests.submittedAt), isNull(credentialRequests.closedAt))
    );
  } else if (opts?.state === "submitted") {
    filters.push(
      and(
        isNotNull(credentialRequests.submittedAt),
        isNull(credentialRequests.closedAt)
      )
    );
  } else if (opts?.state === "closed") {
    filters.push(isNotNull(credentialRequests.closedAt));
  }

  const rows = await db()
    .select({
      id: credentialRequests.id,
      clientId: credentialRequests.clientId,
      clientName: clients.name,
      title: credentialRequests.title,
      description: credentialRequests.description,
      fieldsSchema: credentialRequests.fieldsSchema,
      submittedAt: credentialRequests.submittedAt,
      closedAt: credentialRequests.closedAt,
      createdAt: credentialRequests.createdAt,
      hasSubmission: credentialRequests.encryptedSubmission,
      requestedByName: users.name,
    })
    .from(credentialRequests)
    .leftJoin(clients, eq(clients.id, credentialRequests.clientId))
    .leftJoin(users, eq(users.id, credentialRequests.requestedByUserId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(credentialRequests.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: r.clientName ?? "(unknown)",
    title: r.title,
    description: r.description,
    state: stateOf(r.submittedAt, r.closedAt),
    fieldsSchema: parseFieldsSchema(r.fieldsSchema),
    requestedByName: r.requestedByName,
    submittedAt: r.submittedAt ? new Date(r.submittedAt) : null,
    closedAt: r.closedAt ? new Date(r.closedAt) : null,
    createdAt: new Date(r.createdAt),
    hasSubmission: Boolean(r.hasSubmission),
  }));
}

/* ──────────────────────────────────────────────────────────────────────────
   Founder-only — decrypt + view
   ──────────────────────────────────────────────────────────────────────── */

export type DecryptedRequest = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string | null;
  state: RequestState;
  fieldsSchema: FieldSchema[];
  /** Plaintext values — null if not submitted, also null after close. */
  values: Record<string, string> | null;
  requestedByName: string | null;
  submittedAt: Date | null;
  closedAt: Date | null;
  closeNote: string | null;
  createdAt: Date;
};

/**
 * Decrypts the bundle. Founder-only. Every call writes a
 * `credential.viewed` audit log entry — that's the auditability
 * commitment for the patient.
 */
export async function viewCredentialRequestForFounder(
  id: string
): Promise<DecryptedRequest | null> {
  const session = await requireFounder();
  const rows = await db()
    .select({
      id: credentialRequests.id,
      clientId: credentialRequests.clientId,
      clientName: clients.name,
      title: credentialRequests.title,
      description: credentialRequests.description,
      fieldsSchema: credentialRequests.fieldsSchema,
      encryptedSubmission: credentialRequests.encryptedSubmission,
      submittedAt: credentialRequests.submittedAt,
      closedAt: credentialRequests.closedAt,
      closeNote: credentialRequests.closeNote,
      createdAt: credentialRequests.createdAt,
      requestedByName: users.name,
    })
    .from(credentialRequests)
    .leftJoin(clients, eq(clients.id, credentialRequests.clientId))
    .leftJoin(users, eq(users.id, credentialRequests.requestedByUserId))
    .where(eq(credentialRequests.id, id))
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  let values: Record<string, string> | null = null;
  if (r.encryptedSubmission) {
    try {
      values = await decryptCredentialPayload<Record<string, string>>(
        r.encryptedSubmission
      );
    } catch (err) {
      console.error("[credentials] decryption failed", err);
      values = null;
    }
    // Audit only when there's actually a payload to view.
    await recordAudit({
      actorUserId: session.user.id,
      action: "credential.viewed",
      targetType: "credential_request",
      targetId: r.id,
    });
  }

  return {
    id: r.id,
    clientId: r.clientId,
    clientName: r.clientName ?? "(unknown)",
    title: r.title,
    description: r.description,
    state: stateOf(r.submittedAt, r.closedAt),
    fieldsSchema: parseFieldsSchema(r.fieldsSchema),
    values,
    requestedByName: r.requestedByName,
    submittedAt: r.submittedAt ? new Date(r.submittedAt) : null,
    closedAt: r.closedAt ? new Date(r.closedAt) : null,
    closeNote: r.closeNote,
    createdAt: new Date(r.createdAt),
  };
}

/* ──────────────────────────────────────────────────────────────────────── */

void or;

function stateOf(
  submittedAt: Date | null,
  closedAt: Date | null
): RequestState {
  if (closedAt) return "closed";
  if (submittedAt) return "submitted";
  return "open";
}

function parseFieldsSchema(raw: string | null | undefined): FieldSchema[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (f): f is FieldSchema =>
          typeof f === "object" &&
          f !== null &&
          typeof (f as { key?: unknown }).key === "string" &&
          typeof (f as { label?: unknown }).label === "string"
      )
      .map((f) => ({
        key: f.key,
        label: f.label,
        kind: (ALLOWED_FIELD_KINDS.has(f.kind)
          ? f.kind
          : "text") as FieldKind,
        required: Boolean(f.required),
        placeholder: typeof (f as { placeholder?: unknown }).placeholder === "string"
          ? (f as { placeholder?: string }).placeholder
          : undefined,
      }));
  } catch {
    return [];
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

async function notifyPatientOfNewRequest({
  clientId,
  title,
}: {
  clientId: string;
  title: string;
}): Promise<void> {
  const rows = await db()
    .select({
      orgName: clients.name,
      contactEmail: users.email,
      contactName: users.name,
    })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.primaryUserId))
    .where(eq(clients.id, clientId))
    .limit(1);
  const r = rows[0];
  if (!r?.contactEmail) return;
  try {
    await sendBrandEmail({
      to: r.contactEmail,
      subject: `Action needed — ${title}`,
      html: brandWrap(`
        <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greet(r.contactName)}</h1>
        <p style="margin:0 0 16px 0;">
          Your doctor needs some credentials to keep working on
          <strong style="color:#F2F4F7;">${escapeHtml(r.orgName ?? "your site")}</strong>:
          <em>${escapeHtml(title)}</em>.
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="https://app.thecodedoctors.com/credentials"
             style="display:inline-block;background:#3DD9D6;color:#0A0E13;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
            Open the request
          </a>
        </p>
        <p style="margin:0;color:#9AA4B2;font-size:13px;">
          What you submit is encrypted on our servers. Only the founder can view it,
          every view is logged, and we wipe the values when we&apos;re done.
        </p>
      `),
    });
  } catch (err) {
    console.error("[credentials] new-request email failed", err);
  }
}

async function notifyOnSubmission(cred: {
  id: string;
  clientId: string;
  title: string;
  requestedByUserId: string | null;
}): Promise<void> {
  // We notify (a) whoever requested it, and (b) the founder address
  // from `site.emails.general` as a backstop. If they're the same,
  // de-dupe.
  const recipients = new Set<string>();
  recipients.add(site.emails.general);
  if (cred.requestedByUserId) {
    const rows = await db()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, cred.requestedByUserId))
      .limit(1);
    if (rows[0]?.email) recipients.add(rows[0].email);
  }

  // Pull the patient name for the subject line.
  const c = await db()
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, cred.clientId))
    .limit(1);
  const patient = c[0]?.name ?? "a patient";

  for (const to of recipients) {
    try {
      await sendBrandEmail({
        to,
        subject: `Credentials ready — ${patient}: ${cred.title}`,
        html: brandWrap(`
          <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">A patient just submitted credentials.</h1>
          <p style="margin:0 0 16px 0;">
            <strong style="color:#F2F4F7;">${escapeHtml(patient)}</strong> filled in
            <em>${escapeHtml(cred.title)}</em>.
          </p>
          <p style="margin:0 0 24px 0;">
            <a href="https://admin.thecodedoctors.com/credentials/${cred.id}"
               style="display:inline-block;background:#3DD9D6;color:#0A0E13;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
              Open in the practice portal
            </a>
          </p>
          <p style="margin:0;color:#9AA4B2;font-size:13px;">
            Founder-only access. Every view is logged.
          </p>
        `),
      });
    } catch (err) {
      console.error("[credentials] submit email failed", err);
    }
  }
}

function brandWrap(body: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#0A0E13;color:#F2F4F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
  <div style="max-width:560px;margin:0 auto;padding:32px;">
    <p style="color:#3DD9D6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,monospace;margin:0 0 24px 0;">${site.name}</p>
    ${body}
    <p style="margin:32px 0 0 0;color:#9AA4B2;font-size:11px;">${site.name} · ${site.url}</p>
  </div>
</body>
</html>`;
}

function greet(name: string | null): string {
  return name ? `Hi ${escapeHtml(name)}.` : "Hi.";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
