"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps every internal navigation in document.startViewTransition() so that
 * cross-page transitions feel like a native mobile-app screen change.
 *
 * Works with React 19.2 stable (no canary required). The actual fade/slide
 * animation comes from the ::view-transition-old/new CSS in globals.css.
 *
 * Browsers without startViewTransition (e.g. older Firefox) fall through to
 * standard Next.js client navigation — no jank, just no animation.
 */
export function ViewTransitions() {
  const router = useRouter();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (typeof document.startViewTransition !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onClick = (event: MouseEvent) => {
      // Only plain left-clicks, no modifiers.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.defaultPrevented
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip non-navigations.
      if (href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("rel")?.includes("external")) return;
      if (anchor.target && anchor.target !== "_self") return;

      // External link?
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      // Same path? Let Next handle (no transition needed).
      const target_path = url.pathname + url.search + url.hash;
      const current_path =
        window.location.pathname + window.location.search + window.location.hash;
      if (target_path === current_path) return;

      // We're handling it.
      event.preventDefault();

      const startTransition = document.startViewTransition;
      if (!startTransition) {
        router.push(target_path);
        return;
      }

      startTransition(() => {
        router.push(target_path);
        // Resolve once the new pathname is reflected in the URL — gives React
        // a chance to commit the new page before the snapshot is captured.
        return new Promise<void>((resolve) => {
          const want = url.pathname;
          const start = performance.now();
          const tick = () => {
            if (window.location.pathname === want || performance.now() - start > 1500) {
              requestAnimationFrame(() => resolve());
            } else {
              requestAnimationFrame(tick);
            }
          };
          tick();
        });
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [router]);

  return null;
}
