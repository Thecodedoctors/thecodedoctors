import type { Metadata } from "next";
import Link from "next/link";
import {
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Archive,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { listCredentialRequestsForStaff } from "@/server/credentials";
import { isCredentialCryptoConfigured } from "@/lib/credential-crypto";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Credentials · Practice",
  robots: { index: false, follow: false },
};

const STATE_CONFIG = {
  open: {
    label: "Awaiting patient",
    cls: "bg-warning/10 text-warning ring-warning/30",
    icon: AlertCircle,
  },
  submitted: {
    label: "Ready to view",
    cls: "bg-success/10 text-success ring-success/30",
    icon: CheckCircle2,
  },
  closed: {
    label: "Closed",
    cls: "bg-muted/10 text-muted ring-muted/20",
    icon: Archive,
  },
} as const;

export default async function AdminCredentialsPage() {
  const rows = await listCredentialRequestsForStaff();
  const ready = rows.filter((r) => r.state === "submitted");
  const open = rows.filter((r) => r.state === "open");
  const cryptoConfigured = isCredentialCryptoConfigured();

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Credentials
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Credential vault
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Per-patient sensitive submissions — encrypted at rest, founder-only
          to read. Create requests from a patient&apos;s detail page;
          view/close them here.
        </p>
      </div>

      {!cryptoConfigured && (
        <div className="mt-8 rounded-2xl border border-warning/30 bg-warning/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-warning">
            Encryption key not set
          </p>
          <p className="mt-2 text-sm text-foreground">
            Set <span className="font-mono">CREDENTIAL_ENCRYPTION_KEY</span>{" "}
            on the worker (32 bytes, base64 — generate with{" "}
            <span className="font-mono">openssl rand -base64 32</span>) before
            patients submit. Otherwise creation + submission will fail loudly.
          </p>
        </div>
      )}

      {ready.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-success">
            Ready to view
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-success/30 bg-success/5">
            {ready.map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </ul>
        </section>
      )}

      {open.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-warning">
            Awaiting patient
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {open.map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          History
        </h2>
        {rows.filter((r) => r.state === "closed").length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
            No closed requests yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {rows.filter((r) => r.state === "closed").map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </ul>
        )}
      </section>
    </Section>
  );
}

function Row({
  row,
}: {
  row: Awaited<ReturnType<typeof listCredentialRequestsForStaff>>[number];
}) {
  const cfg = STATE_CONFIG[row.state];
  const Icon = cfg.icon;
  return (
    <li>
      <Link
        href={`/credentials/${row.id}`}
        className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface/40"
      >
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
            cfg.cls
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-base font-medium text-foreground">{row.title}</p>
            <span className="font-mono text-[11px] text-muted">
              {row.clientName}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                cfg.cls
              )}
            >
              {cfg.label}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {row.submittedAt ? (
              <>Sent {formatRelativeAgo(row.submittedAt)}</>
            ) : row.closedAt ? (
              <>Closed {formatRelativeAgo(row.closedAt)}</>
            ) : (
              <>Asked {formatRelativeAgo(row.createdAt)}</>
            )}
            {row.requestedByName && <> · by {row.requestedByName}</>}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted" />
      </Link>
    </li>
  );
}

void KeyRound;
