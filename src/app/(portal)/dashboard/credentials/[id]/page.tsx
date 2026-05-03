import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
  Archive,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  getCredentialRequestForCurrentUser,
  submitCredentialRequest,
  type FieldKind,
} from "@/server/credentials";
import { formatAbsolute, formatRelativeAgo } from "@/lib/time";

export const metadata: Metadata = {
  title: "Credential request",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ submitted?: string }>;

export default async function PatientCredentialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const req = await getCredentialRequestForCurrentUser(id);
  if (!req) notFound();

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/credentials"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All credential requests
        </Link>

        <div className="mt-6 flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              {req.state === "open"
                ? "Action needed"
                : req.state === "submitted"
                  ? "Submitted"
                  : "Closed"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              {req.title}
            </h1>
            <p className="mt-2 font-mono text-xs text-muted">
              Asked by {req.requestedByName ?? "your doctor"}{" "}
              · {formatRelativeAgo(req.createdAt)}
            </p>
          </div>
        </div>

        {req.description && (
          <p className="mt-6 rounded-2xl border border-border bg-surface/30 p-5 text-sm leading-relaxed text-foreground">
            {req.description}
          </p>
        )}

        {req.state === "submitted" && (
          <SubmittedView submittedAt={req.submittedAt!} just={sp.submitted === "1"} />
        )}

        {req.state === "closed" && (
          <ClosedView closedAt={req.closedAt!} />
        )}

        {req.state === "open" && (
          <SubmitForm
            requestId={req.id}
            fields={req.fieldsSchema}
          />
        )}
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function SubmitForm({
  requestId,
  fields,
}: {
  requestId: string;
  fields: { key: string; label: string; kind: FieldKind; required: boolean; placeholder?: string }[];
}) {
  return (
    <form
      action={submitCredentialRequest}
      className="mt-8 space-y-5 rounded-2xl border border-border bg-surface/30 p-6"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div className="rounded-xl border border-accent/30 bg-accent-soft/15 p-4 text-sm">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-foreground">
            Heads up: <span className="text-foreground">once you submit, you
            won&apos;t be able to see these values again.</span>{" "}
            <span className="text-muted">
              Make sure they&apos;re correct before clicking submit. We treat
              this as a one-way deposit so a stale browser or screenshot
              can&apos;t leak the values.
            </span>
          </p>
        </div>
      </div>

      {fields.map((f) => (
        <FieldInput key={f.key} field={f} />
      ))}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Submit credentials
        </button>
        <p className="text-xs text-muted">
          Encrypted on our servers · founder-only · every read is logged.
        </p>
      </div>
    </form>
  );
}

function FieldInput({
  field,
}: {
  field: { key: string; label: string; kind: FieldKind; required: boolean; placeholder?: string };
}) {
  const labelEl = (
    <span className="mb-2 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
      <span>{field.label}</span>
      {field.required ? (
        <span className="text-accent">required</span>
      ) : (
        <span>optional</span>
      )}
    </span>
  );

  if (field.kind === "multiline") {
    return (
      <label className="block">
        {labelEl}
        <textarea
          name={field.key}
          required={field.required}
          rows={4}
          maxLength={5000}
          placeholder={field.placeholder ?? ""}
          autoComplete="off"
          className="w-full resize-y rounded-lg bg-background px-3 py-3 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
        />
      </label>
    );
  }

  const inputType =
    field.kind === "password" || field.kind === "api_key"
      ? "password"
      : field.kind === "url"
        ? "url"
        : "text";

  return (
    <label className="block">
      {labelEl}
      <input
        type={inputType}
        name={field.key}
        required={field.required}
        maxLength={5000}
        placeholder={field.placeholder ?? ""}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-lg bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
      />
    </label>
  );
}

function SubmittedView({
  submittedAt,
  just,
}: {
  submittedAt: Date;
  just: boolean;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-success/30 bg-success/5 p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-success/10 text-success ring-1 ring-inset ring-success/30">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
            {just ? "Just submitted" : "Submitted"}
          </p>
          <p className="mt-1 text-sm text-foreground">
            Sent on {formatAbsolute(submittedAt)}. Your doctor will pick it up
            from here.
          </p>
          <p className="mt-3 text-xs text-muted">
            We keep the values encrypted and don&apos;t show them back to you.
            If you need to update something, ask your doctor to open a new
            request.
          </p>
        </div>
      </div>
    </div>
  );
}

function ClosedView({ closedAt }: { closedAt: Date }) {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface/30 p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted/10 text-muted ring-1 ring-inset ring-muted/20">
          <Archive className="h-5 w-5" />
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Closed
          </p>
          <p className="mt-1 text-sm text-foreground">
            Closed on {formatAbsolute(closedAt)}. The credentials are no
            longer stored — your doctor either rotated them or no longer
            needs access.
          </p>
        </div>
      </div>
    </div>
  );
}
