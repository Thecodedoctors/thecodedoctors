"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget — rendered as a controlled child component.
 *
 * The widget reports its current token (or empty-string when expired/
 * errored) to the parent via `onToken`. The parent passes that token
 * to the server, which verifies it against challenges.cloudflare.com.
 *
 * Implementation notes:
 *
 * - We inject the Turnstile script imperatively and poll for
 *   `window.turnstile` instead of relying on next/script's onLoad
 *   callback. The next/script callback can fire BEFORE the script
 *   finishes initializing the global, which silently strands the
 *   widget — polling avoids the race.
 *
 * - The script is injected at most once per document; subsequent
 *   widgets share the same window.turnstile instance.
 *
 * - `onToken` is captured into a ref so a parent that recreates the
 *   callback on every render doesn't tear down + re-mount the widget
 *   (which would re-issue the captcha challenge each keystroke).
 *
 * - If NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't configured (dev / preview),
 *   the component renders a small placeholder and reports an empty
 *   token. The server-side verifyTurnstile() helper has matching dev
 *   pass-through behaviour for the missing secret.
 *
 * - The host site MUST allowlist `challenges.cloudflare.com` in CSP
 *   (script-src, frame-src, connect-src) — without that the widget
 *   never loads even if this component is correct. See next.config.ts.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

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

function ensureScriptInjected() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src^="${SCRIPT_SRC}"]`)) return;
  const script = document.createElement("script");
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

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

  // Capture the latest onToken into a ref so we don't re-mount the
  // widget on every parent re-render. Turnstile would otherwise re-
  // challenge the user each time a sibling input changes.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;
    if (!hostRef.current) return;
    if (widgetIdRef.current) return;

    ensureScriptInjected();

    let cancelled = false;
    const start = Date.now();

    function tryRender() {
      if (cancelled) return;
      if (widgetIdRef.current) return;
      if (!hostRef.current) return;
      if (!window.turnstile) {
        // Stop polling after 15s — script is dead and we'd just leak
        // intervals. The form's client-side guard will surface
        // "complete the captcha" if this happens.
        if (Date.now() - start > 15_000) return;
        setTimeout(tryRender, 150);
        return;
      }
      widgetIdRef.current = window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
        theme,
      });
    }

    tryRender();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore — widget may already be gone */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme]);

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

  return <div ref={hostRef} className={className ?? "cf-turnstile-host"} />;
}
