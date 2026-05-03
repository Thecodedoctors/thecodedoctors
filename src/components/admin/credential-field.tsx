"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

/**
 * One row in the founder's decrypted-credential view. Passwords +
 * api keys default to dotted-out; click the eye to reveal. Every
 * value gets a copy-to-clipboard button. Plaintext lives in the
 * client component's React state — never written to localStorage,
 * never sent back to the server.
 */
export function CredentialField({
  label,
  kind,
  value,
}: {
  label: string;
  kind: "text" | "password" | "url" | "multiline" | "api_key";
  value: string;
}) {
  const sensitive = kind === "password" || kind === "api_key";
  const [revealed, setRevealed] = useState(!sensitive);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined
    );
  }

  const display = sensitive && !revealed ? maskValue(value) : value;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {sensitive && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? "Hide" : "Reveal"}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"
            >
              {revealed ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label="Copy"
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      {kind === "multiline" ? (
        <pre className="whitespace-pre-wrap break-words rounded-lg bg-background px-3 py-3 font-mono text-sm text-foreground ring-1 ring-inset ring-border">
          {display || <span className="text-muted">(empty)</span>}
        </pre>
      ) : (
        <p className="break-all rounded-lg bg-background px-3 py-2.5 font-mono text-sm text-foreground ring-1 ring-inset ring-border">
          {display || <span className="text-muted">(empty)</span>}
        </p>
      )}
    </div>
  );
}

function maskValue(value: string): string {
  if (!value) return "";
  // Dotted preview, but reveal the last 2 chars so the founder can sanity-check.
  const tail = value.slice(-2);
  return "•".repeat(Math.max(8, value.length - 2)) + tail;
}
