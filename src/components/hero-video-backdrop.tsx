"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero background video — engineered so it CANNOT hurt page speed:
 *
 *  - The section paints instantly on the existing dark background;
 *    the <video> is never render-blocking and never the LCP element.
 *  - `preload="none"` + the `src` is attached only AFTER mount and
 *    only when it's appropriate to play — so the 4 MB file is never
 *    downloaded on mobile, on a data-saver / slow connection, or for
 *    visitors who prefer reduced motion. Those visitors just get the
 *    calm dark hero (no asset fetched at all).
 *  - Fades in once it can actually play, so there's no flash.
 *  - A dark gradient overlay sits on top for text contrast (the clip
 *    is a bright office scene) and to keep the brand's calm tone.
 *
 * NOTE: the file in /public/hero-bg.mp4 is the watermarked stock
 * "preview" — for LOCAL look only. Production needs a licensed,
 * compressed (≈720p, ~600–900 kbps, no audio, short loop) export.
 */
export function HeroVideoBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Don't fetch/play the heavy clip when it would be wasteful or
    // unwanted.
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const tooSmall = window.matchMedia("(max-width: 767px)").matches;
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const saveData = conn?.saveData === true;
    const slow =
      conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g";

    if (reduceMotion || tooSmall || saveData || slow) return;

    // Attach the source now (preload was "none", so nothing was
    // fetched until this point) and play muted/inline.
    video.src = "/hero-bg.mp4";
    const onCanPlay = () => setReady(true);
    video.addEventListener("canplay", onCanPlay, { once: true });
    const p = video.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        /* autoplay blocked — leave the calm dark hero, no error */
      });
    }
    return () => video.removeEventListener("canplay", onCanPlay);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 select-none"
    >
      {/* DESKTOP — video backdrop + dark overlay + 4-beat draw-on ECG.
          Whole layer is md:+ only (the <video> is also mobile-gated in
          the effect above). Mobile renders the original ambient EKG
          backdrop below instead — unchanged from before this redesign. */}
      <div className="absolute inset-0 hidden bg-background md:block">
        <video
          ref={ref}
          muted
          loop
          playsInline
          preload="none"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Contrast + brand tone */}
        <div className="absolute inset-0 bg-background/78" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/82 to-background/45" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        {/* Darker band so the accent trace pops */}
        <div className="absolute inset-x-0 top-1/2 h-56 -translate-y-1/2 bg-gradient-to-b from-transparent via-background/55 to-transparent" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-border-strong/70 to-transparent opacity-50" />
        <svg
          className="absolute inset-x-0 top-1/2 mx-auto h-52 w-full max-w-6xl -translate-y-1/2"
          viewBox="0 0 1200 200"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="ecg-fade" x1="0" x2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="0.12" stopColor="var(--accent)" stopOpacity="1" />
              <stop offset="0.88" stopColor="var(--accent)" stopOpacity="1" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <filter id="ecg-glow" x="-10%" y="-60%" width="120%" height="220%">
              <feGaussianBlur stdDeviation="3.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            className="ecg-trace"
            d={ECG_D}
            pathLength={2000}
            stroke="url(#ecg-fade)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ecg-glow)"
          />
        </svg>
        <div className="absolute inset-x-0 -top-28 mx-auto h-96 max-w-4xl rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* MOBILE — the ORIGINAL ambient EKG backdrop, byte-for-byte as
          it was before the video/ECG redesign: no video, no dark
          overlay, just the page background + the original animated
          EKG line. */}
      <div className="md:hidden">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent opacity-60" />
        <svg
          className="absolute inset-x-0 top-1/2 mx-auto h-44 w-full max-w-6xl -translate-y-1/2 opacity-90"
          viewBox="0 0 1200 200"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="ekg-fade" x1="0" x2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="0.15" stopColor="var(--accent)" stopOpacity="0.55" />
              <stop offset="0.85" stopColor="var(--accent)" stopOpacity="0.55" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            className="ekg-line"
            d="M0 100 L200 100 L260 100 L280 60 L300 140 L320 80 L340 100 L600 100 L660 100 L680 30 L700 170 L720 70 L740 100 L1000 100 L1200 100"
            stroke="url(#ekg-fade)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-x-0 -top-32 mx-auto h-96 max-w-4xl rounded-full bg-accent/10 blur-3xl" />
      </div>
    </div>
  );
}

/**
 * One realistic cardiac cycle — P wave, QRS complex, T wave, with a
 * true isoelectric baseline between beats — tiled four times across
 * the 1200-unit viewBox (baseline y=100, R-peak up to y≈26).
 */
const ECG_BEAT = (x: number) =>
  [
    `C${x + 22} 100 ${x + 34} 78 ${x + 48} 78`,
    `C${x + 62} 78 ${x + 74} 100 ${x + 88} 100`, // P wave
    `L${x + 138} 100`, // PR segment
    `L${x + 147} 112`, // Q
    `L${x + 156} 26`, // R (tall spike)
    `L${x + 166} 140`, // S (under-shoot)
    `L${x + 176} 100`, // J point
    `L${x + 198} 100`, // ST segment
    `C${x + 214} 100 ${x + 226} 72 ${x + 246} 72`,
    `C${x + 266} 72 ${x + 278} 100 ${x + 300} 100`, // T wave → next beat
  ].join(" ");

const ECG_D =
  "M0 100 " + [0, 300, 600, 900].map(ECG_BEAT).join(" ");
