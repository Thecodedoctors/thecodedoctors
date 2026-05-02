import { Paperclip, Download, Trash2, Image as ImageIcon, FileText, FileArchive, FileJson } from "lucide-react";
import { listFilesForRequest, deleteFile } from "@/server/files";
import { formatRelativeAgo } from "@/lib/time";
import { FileUploader } from "@/components/file-uploader";

/**
 * Server component that lists attached files for a request and renders
 * the uploader. Used on both portal and admin request detail pages.
 *
 * The `viewer` prop carries the current user's id + role so we know
 * whether to show the delete button per file (only the uploader OR any
 * staff can delete).
 */
export async function RequestFiles({
  requestId,
  viewer,
}: {
  requestId: string;
  viewer: { id: string; role: string | undefined };
}) {
  const files = await listFilesForRequest(requestId);
  const isStaff = viewer.role !== "client" && Boolean(viewer.role);

  return (
    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Attachments
        </h2>
        {files.length > 0 && (
          <span className="font-mono text-[11px] text-muted">
            {files.length} file{files.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {files.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-6 text-center text-sm text-muted">
          No files attached yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {files.map((f) => {
            const canDelete = isStaff || f.uploaderUserId === viewer.id;
            const Icon = iconForType(f.contentType);
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted ring-1 ring-inset ring-border">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={`/api/files/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
                  >
                    {f.filename}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                    <span>{prettyBytes(f.sizeBytes)}</span>
                    <span>·</span>
                    <span>{f.contentType.split(";")[0]}</span>
                    <span>·</span>
                    <span>
                      {f.uploaderName ?? "(unknown)"} ·{" "}
                      {formatRelativeAgo(f.createdAt)}
                    </span>
                  </div>
                </div>
                <a
                  href={`/api/files/${f.id}?dl=1`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
                  aria-label="Download"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {canDelete && (
                  <form action={deleteFile} className="shrink-0">
                    <input type="hidden" name="fileId" value={f.id} />
                    <button
                      type="submit"
                      aria-label="Remove"
                      title="Remove"
                      className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-signal/10 hover:text-signal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5">
        <FileUploader requestId={requestId} />
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function iconForType(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  if (type === "application/zip") return FileArchive;
  if (type === "application/json") return FileJson;
  if (type.startsWith("text/")) return FileText;
  return Paperclip;
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
