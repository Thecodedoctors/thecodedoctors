"use server";

import { db, clientBackups, users } from "@/db";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser, requireStaff } from "@/lib/auth-helpers";
import { getOrCreateClientForUser } from "@/lib/clients";
import { recordAudit } from "@/server/audit";

/**
 * Backup ledger. Doctors record snapshots they've taken; patients see
 * the recent ones in their portal so they know the "daily backups"
 * promise on the plan is actually being kept.
 *
 * The archive bytes themselves live elsewhere (host panel, R2, etc.).
 * `location` is a free-text pointer — visible to staff, surfaced as
 * "stored on X" to patients (no raw key leakage).
 */

const ALLOWED_KINDS = new Set(["full", "db", "files"]);
const MAX_NOTES = 500;
const MAX_LOCATION = 500;

export type BackupRow = {
  id: string;
  takenAt: Date;
  kind: string;
  sizeBytes: number | null;
  notes: string | null;
  location: string | null;
  recordedByName: string | null;
};

/* ──────────────────────────────────────────────────────────────────────────
   Reads
   ──────────────────────────────────────────────────────────────────────── */

export async function listBackupsForCurrentUser(): Promise<BackupRow[]> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  return loadBackupsForClient(client.id, /* includeLocation */ false);
}

export async function listBackupsForClientStaff(
  clientId: string
): Promise<BackupRow[]> {
  await requireStaff();
  return loadBackupsForClient(clientId, /* includeLocation */ true);
}

async function loadBackupsForClient(
  clientId: string,
  includeLocation: boolean
): Promise<BackupRow[]> {
  const rows = await db()
    .select({
      id: clientBackups.id,
      takenAt: clientBackups.takenAt,
      kind: clientBackups.kind,
      sizeBytes: clientBackups.sizeBytes,
      notes: clientBackups.notes,
      location: clientBackups.location,
      recordedByName: users.name,
    })
    .from(clientBackups)
    .leftJoin(users, eq(users.id, clientBackups.recordedByUserId))
    .where(eq(clientBackups.clientId, clientId))
    .orderBy(desc(clientBackups.takenAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    takenAt: new Date(r.takenAt),
    kind: r.kind,
    sizeBytes: r.sizeBytes,
    notes: r.notes,
    // Patients only get a treatment hint, not the raw key.
    location: includeLocation ? r.location : prettyLocation(r.location),
    recordedByName: r.recordedByName,
  }));
}

/* ──────────────────────────────────────────────────────────────────────────
   Mutations (staff only)
   ──────────────────────────────────────────────────────────────────────── */

export async function recordBackup(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const kindRaw = String(formData.get("kind") ?? "full");
  const kind = ALLOWED_KINDS.has(kindRaw) ? kindRaw : "full";
  const sizeRaw = String(formData.get("sizeBytes") ?? "").trim();
  const sizeBytes =
    sizeRaw && Number.isFinite(Number(sizeRaw)) ? Number(sizeRaw) : null;
  const notes = String(formData.get("notes") ?? "").slice(0, MAX_NOTES) || null;
  const location =
    String(formData.get("location") ?? "").slice(0, MAX_LOCATION) || null;

  const id = crypto.randomUUID();
  await db().insert(clientBackups).values({
    id,
    clientId,
    recordedByUserId: session.user.id,
    kind,
    sizeBytes,
    notes,
    location,
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "backup.record",
    targetType: "client",
    targetId: clientId,
    after: { backupId: id, kind, sizeBytes },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/backups");
}

export async function deleteBackupRecord(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const backupId = String(formData.get("backupId") ?? "");
  if (!backupId) return;

  const rows = await db()
    .select({ clientId: clientBackups.clientId })
    .from(clientBackups)
    .where(eq(clientBackups.id, backupId))
    .limit(1);
  if (rows.length === 0) return;
  const clientId = rows[0].clientId;

  await db().delete(clientBackups).where(eq(clientBackups.id, backupId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "backup.delete",
    targetType: "client",
    targetId: clientId,
    before: { backupId },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/dashboard/backups");
}

/* ──────────────────────────────────────────────────────────────────────── */

/** Strip secrets out of a backup location for patient eyes. We show
 *  "stored on Cloudflare R2" / "stored on host" — never the raw key. */
function prettyLocation(loc: string | null): string | null {
  if (!loc) return null;
  if (loc.startsWith("r2://") || loc.includes("r2.cloudflarestorage.com")) {
    return "Stored on Cloudflare R2";
  }
  if (/^https?:\/\//.test(loc)) {
    try {
      const host = new URL(loc).hostname.replace(/^www\./, "");
      return `Stored on ${host}`;
    } catch {
      return "Stored externally";
    }
  }
  return "Stored on file";
}
