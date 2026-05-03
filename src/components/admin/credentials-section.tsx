import Link from "next/link";
import {
  KeyRound,
  Plus,
  CheckCircle2,
  AlertCircle,
  Archive,
  ArrowRight,
} from "lucide-react";
import { listCredentialRequestsForStaff } from "@/server/credentials";
import { isCredentialCryptoConfigured } from "@/lib/credential-crypto";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

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

export async function CredentialsSection({ clientId }: { clientId: string }) {
  const requests = await listCredentialRequestsForStaff({ clientId });
  const cryptoOk = isCredentialCryptoConfigured();

  return (
    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Credentials
        </h2>
        <Link
          href={`/credentials/new?clientId=${clientId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-signal hover:text-signal"
        >
          <Plus className="h-3 w-3" />
          Request credentials
        </Link>
      </div>

      {!cryptoOk && (
        <p className="mb-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-foreground">
          <span className="font-mono">CREDENTIAL_ENCRYPTION_KEY</span> isn&apos;t
          set on the worker. Creating + viewing requests will fail until you
          add it. (32 bytes, base64 — generate with{" "}
          <span className="font-mono">openssl rand -base64 32</span>.)
        </p>
      )}

      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-6 text-center text-sm text-muted">
          No credential requests for this patient.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {requests.map((r) => {
            const cfg = STATE_CONFIG[r.state];
            const Icon = cfg.icon;
            return (
              <li key={r.id}>
                <Link
                  href={`/credentials/${r.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-surface/40"
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-md ring-1 ring-inset",
                      cfg.cls
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.title}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                          cfg.cls
                        )}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {r.submittedAt ? (
                        <>Sent {formatRelativeAgo(r.submittedAt)}</>
                      ) : r.closedAt ? (
                        <>Closed {formatRelativeAgo(r.closedAt)}</>
                      ) : (
                        <>Asked {formatRelativeAgo(r.createdAt)}</>
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

void KeyRound;
