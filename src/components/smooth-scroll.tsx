"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Buttery-smooth scroll for the entire site.
 * - Hijacks the wheel event with eased scrolling (desktop only — touch stays native)
 * - Respects prefers-reduced-motion: skips Lenis entirely
 *
 * Scroll restoration on navigation is left to Next.js / the browser, which
 * matches native-app behaviour: fresh nav → top, back button → restored.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const lenis = new Lenis({
      lerp: 0.1,
      duration: 1.1,
      smoothWheel: true,
    });

    let raf = 0;
    function loop(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
