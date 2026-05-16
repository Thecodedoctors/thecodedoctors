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
      className="pointer-events-none absolute inset-0 -z-0 select-none bg-background"
    >
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
      {/* Contrast + brand tone: keep the left side (where the headline
          sits) dark, fade toward the clip on the right. */}
      <div className="absolute inset-0 bg-background/78" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/82 to-background/45" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
      {/* ECG layer (band + trace + glow) is DESKTOP-ONLY. On phones
          the 1200-wide waveform squished into ~390px (preserveAspect
          none) collided with the body copy and looked broken — and
          the video doesn't load on mobile either, so small screens
          get the clean, calm dark hero. md: = 768px = same breakpoint
          as the video gate. */}
      <div className="hidden md:block">
        {/* Darker band right behind the ECG so the accent trace really
            pops — still translucent, the video stays visible through it. */}
        <div className="absolute inset-x-0 top-1/2 h-56 -translate-y-1/2 bg-gradient-to-b from-transparent via-background/55 to-transparent" />

        {/* Brand ECG cardiac-monitor trace — realistic P-QRS-T wave,
          glowing comet sweep + a beacon that rides the exact path.
          ON TOP of the video + overlay, behind the hero content.
          Pure inline SVG/CSS + native SMIL — no JS, weightless. */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-border-strong/70 to-transparent opacity-50" />
      <svg
        className="absolute inset-x-0 top-1/2 mx-auto h-52 w-full max-w-6xl -translate-y-1/2"
        viewBox="0 0 1200 200"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          {/* edge fade so the trace dissolves at both ends */}
          <linearGradient id="ecg-fade" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="0.12" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="0.88" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          {/* soft bloom for the bright head + beacon */}
          <filter
            id="ecg-glow"
            x="-10%"
            y="-60%"
            width="120%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The trace itself — drawn AS the sweep travels (the moving
            blank bar in .ecg-trace creates the line at its leading
            edge and wipes the prior pass just ahead). Nothing is
            pre-drawn. Its round, glowing leading cap IS the single
            luminous draw-point — no separate beacon dot (which only
            ever stacked a second glow just off this tip). */}
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

      {/* MOBILE ECG — a single, correctly-proportioned heartbeat.
          preserveAspectRatio="xMidYMid meet" (NOT "none") so it keeps
          its shape and never squishes into a scribble at phone width.
          Own <defs> so it doesn't depend on the desktop SVG (which is
          display:none on mobile). Same .ecg-trace draw-on sweep. */}
      <div className="md:hidden" aria-hidden>
        {/* Anchored in the hero's TOP padding band (≈112px of
            guaranteed empty space above the "NOW ACCEPTING" badge) —
            deterministically clear of ALL copy and still above the
            fold/visible. Not centred (ran through the paragraph) and
            not bottom-anchored (fell below the fold). */}
        <div className="absolute inset-x-0 top-3 h-24 bg-gradient-to-b from-transparent via-background/45 to-transparent" />
        <svg
          className="absolute inset-x-0 top-3 mx-auto h-24 w-full opacity-80"
          viewBox="0 0 420 200"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="ecg-fade-m" x1="0" x2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="0.14" stopColor="var(--accent)" stopOpacity="1" />
              <stop offset="0.86" stopColor="var(--accent)" stopOpacity="1" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <filter
              id="ecg-glow-m"
              x="-10%"
              y="-60%"
              width="120%"
              height="220%"
            >
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
            d={ECG_D_MOBILE}
            pathLength={2000}
            stroke="url(#ecg-fade-m)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ecg-glow-m)"
          />
        </svg>
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

/**
 * Mobile: ONE clean beat with flat lead-in/out, in a 420×200 viewBox
 * rendered with preserveAspectRatio="meet" so the heartbeat keeps its
 * true shape at phone width (the desktop 4-beat path squished into
 * ~390px with preserveAspectRatio="none" was the scribble-through-
 * the-text bug).
 */
const ECG_D_MOBILE = `M0 100 L60 100 ${ECG_BEAT(60)} L420 100`;
