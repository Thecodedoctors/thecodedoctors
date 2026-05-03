"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Upload, X, AlertCircle } from "lucide-react";
import { uploadFilesToRequest } from "@/server/files";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/zip",
];

type Failure = { name: string; reason: string };

export function FileUploader({ requestId }: { requestId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [pending, startTransition] = useTransition();

  function pick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setFailures([]);
    const files = Array.from(e.target.files ?? []);
    const ok: File[] = [];
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        setError(`${f.name} is too big (max 10 MB).`);
        continue;
      }
      if (!isAllowed(f.type)) {
        setError(`${f.name} type isn't supported.`);
        continue;
      }
      ok.push(f);
    }
    if (ok.length > 10) {
      setError("Up to 10 files at a time.");
      ok.length = 10;
    }
    setPicked(ok);
  }

  function remove(idx: number) {
    setPicked((p) => p.filter((_, i) => i !== idx));
  }

  function submit() {
    if (picked.length === 0) {
      pick();
      return;
    }
    setError(null);
    setFailures([]);
    const fd = new FormData();
    fd.set("requestId", requestId);
    for (const f of picked) fd.append("files", f);
    startTransition(async () => {
      try {
        const result = await uploadFilesToRequest(fd);
        // Keep only the files that failed in the picker so the user can
        // edit / retry; clear the rest.
        if (result.failed.length > 0) {
          setFailures(result.failed);
          const failedNames = new Set(result.failed.map((f) => f.name));
          setPicked((p) => p.filter((f) => failedNames.has(f.name)));
        } else {
          setPicked([]);
        }
        if (inputRef.current && result.failed.length === 0) {
          inputRef.current.value = "";
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? `Upload failed: ${e.message}`
            : "Upload failed. Try again."
        );
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED.join(",")}
        onChange={onChange}
        className="sr-only"
      />

      {picked.length === 0 ? (
        <button
          type="button"
          onClick={pick}
          className="inline-flex items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach files
        </button>
      ) : (
        <>
          <ul className="space-y-1.5 rounded-xl border border-border bg-surface/40 p-3">
            {picked.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-md bg-background px-3 py-2 text-sm"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {f.name}
                </span>
                <span className="font-mono text-xs text-muted shrink-0">
                  {prettyBytes(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${f.name}`}
                  className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-surface hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee] disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" />
              {pending
                ? "Uploading…"
                : `Upload ${picked.length} file${picked.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={pick}
              className="text-xs text-muted hover:text-foreground"
            >
              Add more…
            </button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-signal">{error}</p>}
      {failures.length > 0 && (
        <div className="rounded-xl border border-signal/30 bg-signal/5 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
                {failures.length} file{failures.length === 1 ? "" : "s"} didn&apos;t upload
              </p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                {failures.map((f, i) => (
                  <li key={i} className="break-all">
                    <span className="font-mono text-muted">{f.name}</span>{" "}
                    — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted">
        Up to 10 files, 10 MB each. Images, PDFs, plain text, JSON, ZIP.
      </p>
    </form>
  );
}

function isAllowed(type: string): boolean {
  if (!type) return false;
  return ALLOWED.includes(type);
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
