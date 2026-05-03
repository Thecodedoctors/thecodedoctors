import type { Metadata } from "next";
import { Database, ShieldCheck, Clock } from "lucide-react";
import { Section } from "@/components/ui/section";
import { listBackupsForCurrentUser } from "@/server/backups";
import { formatRelativeAgo, formatAbsolute } from "@/lib/time";

export const metadata: Metadata = {
  title: "Backups",
  robots: { index: false, follow: false },
};

const KIND_LABEL: Record<string, string> = {
  full: "Full snapshot",
  db: "Database only",
  files: "Files only",
};

export default async function PatientBackupsPage() {
  const backups = await listBackupsForCurrentUser();
  const last = backups[0] ?? null;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Backups
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {last ? "Your site is being backed up." : "Backups will start soon."}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          Every snapshot we take of your site is logged here — kind, size,
          when, and by which doctor. Need to roll back? Reply to your last
          message thread or email{" "}
          <span className="font-mono">hello@thecodedoctors.com</span> and
          we&apos;ll restore from the most recent point.
        </p>

        {last && (
          <div className="mt-8 rounded-2xl border border-success/30 bg-success/5 p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-success/10 text-success ring-1 ring-inset ring-success/30">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
                  Last backup
                </p>
                <p className="mt-1 text-base font-medium text-foreground">
                  {KIND_LABEL[last.kind] ?? last.kind} ·{" "}
                  {formatRelativeAgo(last.takenAt)}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  {last.sizeBytes ? `${prettyBytes(last.sizeBytes)} · ` : ""}
                  {last.location ?? "Stored on file"}
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            History
          </h2>
          {backups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
                <Clock className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm text-foreground">
                No snapshots logged yet — your first will appear within a
                day or two of starting care.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
              {backups.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-4 px-5 py-4"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted ring-1 ring-inset ring-border">
                    <Database className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {KIND_LABEL[b.kind] ?? b.kind}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted">
                      {b.sizeBytes ? `${prettyBytes(b.sizeBytes)} · ` : ""}
                      {b.location ?? "Stored on file"}
                      {b.recordedByName && <> · {b.recordedByName}</>}
                    </p>
                    {b.notes && (
                      <p className="mt-1 text-xs text-muted">{b.notes}</p>
                    )}
                  </div>
                  <time
                    className="font-mono text-xs text-muted"
                    title={formatAbsolute(b.takenAt)}
                  >
                    {formatRelativeAgo(b.takenAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Section>
  );
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
