"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/sentry";

/**
 * Marketing-surface error boundary. Without this, anything that throws
 * on /, /plans, /checkup, /about, etc. falls through to the global
 * "Critical" page — the worst possible thing for a prospect to see on
 * a site whose entire pitch is reliability. This keeps a thrown error
 * contained to a calm, on-brand recoverable panel.
 */
export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[marketing error boundary]", error);
    captureException(error, { surface: "marketing", digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
        Something hiccuped
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        That didn&apos;t load right.
      </h1>
      <p className="mt-3 text-sm text-muted">
        A page on our end didn&apos;t respond. It&apos;s almost certainly
        momentary — try again, or head back home.
      </p>

      {error.digest && (
        <p className="mt-6 inline-flex w-fit items-center gap-2 rounded-md border border-border-strong bg-surface/40 px-3 py-1.5 font-mono text-[11px] text-muted">
          <span className="uppercase tracking-[0.16em]">ref</span>
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
        {/* Intentionally a plain <a>: a full document load recovers
            from whatever client-side state caused the boundary to
            trip, which a soft <Link> nav would not. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="rounded-full border border-border-strong px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent"
        >
          Back home
        </a>
      </div>
    </div>
  );
}
