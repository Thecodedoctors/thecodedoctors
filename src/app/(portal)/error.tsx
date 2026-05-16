"use client";

import { useEffect } from "react";

/**
 * Patient-portal error boundary. Without this, a throw anywhere under
 * the dashboard (a Stripe blip on /billing, a cold-DB read, a bad
 * record) replaces the whole screen with the global "Critical" page.
 * This contains it to a recoverable panel so one failing query doesn't
 * look like the whole product fell over.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
        Page error
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Something didn&apos;t respond.
      </h1>
      <p className="mt-3 text-sm text-muted">
        We&apos;ve been paged and the trace is in our logs. Try again, or
        head back to your dashboard.
      </p>

      {error.digest && (
        <p className="mt-6 inline-flex w-fit items-center gap-2 rounded-md border border-border-strong bg-surface/40 px-3 py-1.5 font-mono text-[11px] text-muted">
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
        {/* Intentionally a plain <a>: a full document load recovers
            from whatever client-side state caused the boundary to
            trip, which a soft <Link> nav would not. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="rounded-full border border-border-strong px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
