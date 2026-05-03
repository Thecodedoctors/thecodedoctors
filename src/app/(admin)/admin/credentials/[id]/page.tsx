import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  Archive,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  viewCredentialRequestForFounder,
  closeCredentialRequest,
} from "@/server/credentials";
import { CredentialField } from "@/components/admin/credential-field";
import { formatAbsolute, formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Credential request · Practice",
  robots: { index: false, follow: false },
};

// Force dynamic so we never prerender (the page calls
// `viewCredentialRequestForFounder` which writes an audit log entry
// and decrypts secrets — both must happen at request time).
export const dynamic = "force-dynamic";

export default async function AdminCredentialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // requireFounder() inside the action — non-founder staff get bounced
  // to /admin before they ever see this page render.
  const cred = await viewCredentialRequestForFounder(id);
  if (!cred) notFound();

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/credentials"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All credentials
        </Link>

        <div className="mt-6 flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-signal/10 text-signal ring-1 ring-inset ring-signal/30">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
              {cred.clientName}
            </p>
            <h1 className="mt-1 flex flex-wrap items-baseline gap-3 text-2xl font-semibold tracking-tight md:text-3xl">
              {cred.title}
              <StateBadge state={cred.state} />
            </h1>
            <p className="mt-2 font-mono text-xs text-muted">
              Asked by {cred.requestedByName ?? "—"} ·{" "}
              {formatRelativeAgo(cred.createdAt)}
              {cred.submittedAt && (
                <> · Submitted {formatRelativeAgo(cred.submittedAt)}</>
              )}
              {cred.closedAt && (
                <> · Closed {formatRelativeAgo(cred.closedAt)}</>
              )}
            </p>
          </div>
        </div>

        {cred.description && (
          <p className="mt-6 rounded-2xl border border-border bg-surface/30 p-5 text-sm leading-relaxed text-foreground">
            {cred.description}
          </p>
        )}

        {/* Founder-only audit notice */}
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-surface/30 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-xs text-muted">
            This page is founder-only. Opening it just wrote a{" "}
            <span className="font-mono">credential.viewed</span> entry to the
            audit log under your user id —{" "}
            <Link
              href="/audit"
              className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              audit log
            </Link>
            .
          </p>
        </div>

        {/* Body — values OR empty-state */}
        {cred.state === "open" && <OpenView />}

        {cred.state === "submitted" && cred.values && (
          <ValuesView fields={cred.fieldsSchema} values={cred.values} />
        )}

        {cred.state === "submitted" && !cred.values && <DecryptFailedView />}

        {cred.state === "closed" && (
          <ClosedView closedAt={cred.closedAt!} note={cred.closeNote} />
        )}

        {/* Close action — visible whenever there's still something on file */}
        {cred.state === "submitted" && (
          <CloseForm requestId={cred.id} />
        )}
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function StateBadge({ state }: { state: "open" | "submitted" | "closed" }) {
  const cfg = {
    open: {
      label: "Awaiting patient",
      cls: "bg-warning/10 text-warning ring-warning/30",
    },
    submitted: {
      label: "Ready to view",
      cls: "bg-success/10 text-success ring-success/30",
    },
    closed: {
      label: "Closed",
      cls: "bg-muted/10 text-muted ring-muted/20",
    },
  }[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}

function OpenView() {
  return (
    <div className="mt-8 rounded-2xl border border-warning/30 bg-warning/5 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-warning">
            Waiting on the patient
          </p>
          <p className="mt-1 text-sm text-foreground">
            They&apos;ve been emailed a link. You&apos;ll get a notification
            (and the page will switch to &ldquo;Ready to view&rdquo;) the
            moment they submit.
          </p>
        </div>
      </div>
    </div>
  );
}

function DecryptFailedView() {
  return (
    <div className="mt-8 rounded-2xl border border-signal/30 bg-signal/5 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-signal" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
            Couldn&apos;t decrypt
          </p>
          <p className="mt-1 text-sm text-foreground">
            The encrypted blob exists but failed to decrypt. Most likely
            cause: the worker&apos;s{" "}
            <span className="font-mono">CREDENTIAL_ENCRYPTION_KEY</span>{" "}
            changed since this was submitted. Check the worker secrets.
          </p>
        </div>
      </div>
    </div>
  );
}

function ValuesView({
  fields,
  values,
}: {
  fields: Awaited<
    ReturnType<typeof viewCredentialRequestForFounder>
  > extends infer T
    ? T extends { fieldsSchema: infer F }
      ? F
      : never
    : never;
  values: Record<string, string>;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface/40 p-6">
      <ul className="space-y-4">
        {(fields as { key: string; label: string; kind: string }[]).map((f) => (
          <li key={f.key}>
            <CredentialField
              label={f.label}
              kind={f.kind as "text" | "password" | "url" | "multiline" | "api_key"}
              value={values[f.key] ?? ""}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClosedView({
  closedAt,
  note,
}: {
  closedAt: Date;
  note: string | null;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface/30 p-6">
      <div className="flex items-start gap-3">
        <Archive className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Closed — values wiped
          </p>
          <p className="mt-1 text-sm text-foreground">
            Closed on {formatAbsolute(closedAt)}. The encrypted blob has
            been removed from the row; metadata + audit history remain.
          </p>
          {note && (
            <p className="mt-3 rounded-md bg-surface/60 px-3 py-2 text-xs text-foreground">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Closing note
              </span>
              <br />
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CloseForm({ requestId }: { requestId: string }) {
  return (
    <form
      action={closeCredentialRequest}
      className="mt-6 rounded-2xl border border-border bg-surface/30 p-6"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Close + wipe
      </p>
      <p className="mt-1 text-sm text-foreground">
        Once you&apos;re done, close the request. We delete the encrypted
        blob from the row and keep only the metadata. There&apos;s no undo.
      </p>
      <label className="mt-4 block">
        <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Closing note (optional)
        </span>
        <input
          type="text"
          name="closeNote"
          maxLength={500}
          placeholder="e.g. Rotated; safe to discard."
          className="w-full rounded-md bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
        />
      </label>
      <button
        type="submit"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-signal/90"
      >
        <Archive className="h-3.5 w-3.5" />
        Close + wipe
      </button>
    </form>
  );
}
