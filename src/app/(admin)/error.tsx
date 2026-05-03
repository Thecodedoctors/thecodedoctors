"use client";

import { useEffect } from "react";

/**
 * Practice-portal error boundary. Catches anything that throws inside
 * /admin/* and surfaces the digest only — partner-doctors and
 * read-only roles get the same staff portal, and we don't want raw
 * exception messages or stack traces in their face. Founders who
 * need to debug can grep `wrangler tail` by digest.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logged client-side and server-side; the worker tail is the
    // canonical place to read the actual stack.
    console.error("[admin error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
        Practice · Page error
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Something didn&apos;t respond.
      </h1>
      <p className="mt-3 text-sm text-muted">
        We&apos;ve been paged and the trace is in the worker logs.
        Try again, or head back to the practice home.
      </p>

      {error.digest && (
        <p className="mt-6 inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface/40 px-3 py-1.5 font-mono text-[11px] text-muted">
          <span className="uppercase tracking-[0.16em]">digest</span>
          <span className="text-foreground">{error.digest}</span>
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-[#e6e9ee]"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-full border border-border-strong px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent"
        >
          Practice home
        </a>
      </div>
    </div>
  );
}
