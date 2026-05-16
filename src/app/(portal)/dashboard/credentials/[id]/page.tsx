import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, KeyRound, Archive } from "lucide-react";
import { Section } from "@/components/ui/section";
import { getCredentialRequestForCurrentUser } from "@/server/credentials";
import { CredentialSubmitForm } from "@/components/credentials/credential-submit-form";
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
          <CredentialSubmitForm
            requestId={req.id}
            fields={req.fieldsSchema}
          />
        )}
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

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
