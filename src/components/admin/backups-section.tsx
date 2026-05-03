import { Database, Plus } from "lucide-react";
import {
  listBackupsForClientStaff,
  recordBackup,
  deleteBackupRecord,
} from "@/server/backups";
import { formatRelativeAgo } from "@/lib/time";

const KIND_LABEL: Record<string, string> = {
  full: "Full snapshot",
  db: "Database only",
  files: "Files only",
};

export async function BackupsSection({ clientId }: { clientId: string }) {
  const backups = await listBackupsForClientStaff(clientId);

  return (
    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Backups
        </h2>
        <span className="text-xs text-muted">
          {backups.length} on record
        </span>
      </div>

      <form
        action={recordBackup}
        className="mb-3 grid gap-3 rounded-2xl border border-border bg-surface/30 p-5 sm:grid-cols-[1fr_auto_auto]"
      >
        <input type="hidden" name="clientId" value={clientId} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Kind
            </span>
            <select
              name="kind"
              defaultValue="full"
              className="w-full rounded-md bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            >
              <option value="full">Full snapshot</option>
              <option value="db">Database only</option>
              <option value="files">Files only</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Size (bytes, optional)
            </span>
            <input
              type="text"
              name="sizeBytes"
              inputMode="numeric"
              placeholder="e.g. 4900000000"
              className="w-full rounded-md bg-background px-3 py-2 font-mono text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            />
          </label>
        </div>
        <label className="block sm:col-span-3">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Location (R2 key, host-panel URL, etc.)
          </span>
          <input
            type="text"
            name="location"
            placeholder="r2://tcd-backups/2026-05-03-lumiere.tar.gz"
            className="w-full rounded-md bg-background px-3 py-2 font-mono text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
          />
        </label>
        <label className="block sm:col-span-3">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Notes (optional — included files, excluded paths, etc.)
          </span>
          <input
            type="text"
            name="notes"
            placeholder="Excluded /uploads/cache/ to keep size down"
            className="w-full rounded-md bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
          />
        </label>
        <div className="sm:col-span-3 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
          >
            <Plus className="h-3.5 w-3.5" />
            Record backup
          </button>
        </div>
      </form>

      {backups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-6 text-center text-sm text-muted">
          No backups recorded yet for this patient.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {backups.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-4 px-5 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted ring-1 ring-inset ring-border">
                <Database className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {KIND_LABEL[b.kind] ?? b.kind}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted truncate">
                  {b.sizeBytes ? `${prettyBytes(b.sizeBytes)} · ` : ""}
                  {b.location ?? "no location set"}
                  {b.recordedByName && <> · {b.recordedByName}</>}
                </p>
                {b.notes && (
                  <p className="mt-1 text-xs text-muted truncate">{b.notes}</p>
                )}
              </div>
              <time className="font-mono text-xs text-muted">
                {formatRelativeAgo(b.takenAt)}
              </time>
              <form action={deleteBackupRecord}>
                <input type="hidden" name="backupId" value={b.id} />
                <button
                  type="submit"
                  aria-label="Remove backup record"
                  className="rounded-md border border-signal/30 px-2.5 py-1 text-[11px] text-signal transition-colors hover:bg-signal/10"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
