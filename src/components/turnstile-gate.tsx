"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

/**
 * Cloudflare Turnstile widget — rendered as a controlled child component.
 * Loads the Turnstile script lazily, mounts the widget once both the
 * script and the host element are ready, and reports the resulting
 * token (or empty-string when expired/errored) back to the parent via
 * `onToken`.
 *
 * If NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't configured (dev / preview
 * without keys) the component renders a small placeholder and calls
 * `onToken("")` so the parent's "captcha required" gate doesn't block.
 * The server-side verifyTurnstile() helper has the matching dev pass-
 * through behaviour for missing TURNSTILE_SECRET_KEY.
 */
export function TurnstileGate({
  onToken,
  theme = "dark",
  className,
}: {
  onToken: (token: string) => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady) return;
    if (!siteKey) return;
    if (!hostRef.current) return;
    if (widgetIdRef.current) return;
    if (!window.turnstile) return;

    widgetIdRef.current = window.turnstile.render(hostRef.current, {
      sitekey: siteKey,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
      theme,
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // onToken is intentionally omitted — re-rendering the widget on every
    // parent state change would re-issue the challenge. Capture the ref once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, siteKey, theme]);

  if (!siteKey) {
    return (
      <p
        className={
          className ??
          "rounded-xl border border-dashed border-border-strong bg-background/40 px-4 py-3 font-mono text-[11px] text-muted"
        }
      >
        [captcha disabled — TURNSTILE_SITE_KEY not configured]
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
      />
      <div ref={hostRef} className={className ?? "cf-turnstile-host"} />
    </>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}
