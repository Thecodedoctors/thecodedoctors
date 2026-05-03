"use client";

import { useEffect } from "react";

/**
 * Practice-portal error boundary. Catches anything that throws inside
 * /admin/* and surfaces the error message + digest to staff. Showing the
 * raw message is fine here — these routes are already gated to staff
 * roles and never reach end users.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
        Practice · Page error
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        This page didn&apos;t render.
      </h1>
      <p className="mt-3 text-sm text-muted">
        An exception was thrown while loading this view. The message is
        shown below for debugging.
      </p>

      <pre className="mt-6 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-signal/30 bg-signal/5 p-5 font-mono text-xs text-foreground">
        <strong className="text-signal">{error.name}:</strong> {error.message}
        {error.digest && (
          <>
            {"\n\n"}
            <span className="text-muted">digest: {error.digest}</span>
          </>
        )}
        {error.stack && (
          <>
            {"\n\n"}
            <span className="text-muted">{error.stack}</span>
          </>
        )}
      </pre>

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
