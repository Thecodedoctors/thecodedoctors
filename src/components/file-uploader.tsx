"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Upload, X } from "lucide-react";
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

export function FileUploader({ requestId }: { requestId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
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
    const fd = new FormData();
    fd.set("requestId", requestId);
    for (const f of picked) fd.append("files", f);
    startTransition(async () => {
      try {
        await uploadFilesToRequest(fd);
        setPicked([]);
        if (inputRef.current) inputRef.current.value = "";
      } catch {
        setError("Upload failed. Try again.");
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
