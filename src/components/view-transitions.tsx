"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps every internal navigation in document.startViewTransition() so that
 * cross-page transitions feel like a native mobile-app screen change.
 *
 * Defensive design: if the view transition or the Next.js router.push throws
 * for any reason, we fall back to native browser navigation via
 * window.location.assign(). The user always navigates — the click is never
 * silently dead.
 *
 * Browsers without startViewTransition (older Firefox, iOS Safari < 18) skip
 * the animation but still get standard Next.js client navigation.
 */
export function ViewTransitions() {
  const router = useRouter();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const supportsVT =
      typeof document.startViewTransition === "function" && !reducedMotion;

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const targetPath = url.pathname + url.search + url.hash;
      const currentPath =
        window.location.pathname + window.location.search + window.location.hash;
      if (targetPath === currentPath) return;

      // We're committing to handle this click. From here on, every path
      // results in navigation — no dead clicks.
      event.preventDefault();
      navigate(targetPath, { router, supportsVT });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [router]);

  return null;
}

type NavigateOpts = {
  router: ReturnType<typeof useRouter>;
  supportsVT: boolean;
};

function navigate(path: string, { router, supportsVT }: NavigateOpts) {
  const fallback = () => {
    try {
      window.location.assign(path);
    } catch {
      // worst-case: hard reload
      window.location.href = path;
    }
  };

  if (!supportsVT) {
    try {
      router.push(path);
    } catch {
      fallback();
    }
    return;
  }

  try {
    document.startViewTransition!(() => {
      try {
        router.push(path);
      } catch {
        fallback();
      }
    });
  } catch {
    // startViewTransition itself threw — try plain push, then native fallback
    try {
      router.push(path);
    } catch {
      fallback();
    }
  }
}
