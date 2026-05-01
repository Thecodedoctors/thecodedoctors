import type { CheckResult, Finding } from "../types";
import { clampScore, gradeFromScore, statusFromScore } from "../scoring";
import type { FetchedPage } from "../fetcher";

/**
 * Performance signal. v1 uses TTFB-equivalent + body weight from our own fetch.
 * When PSI_API_KEY is set, we layer in real Lighthouse perf score from the
 * PageSpeed Insights API for credible numbers.
 *
 * Without PSI: a directional indicator. With PSI: real Lighthouse data.
 */
export async function checkPerformance(page: FetchedPage): Promise<CheckResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  let score = 100;

  // Total time for our fetch (TTFB + body). Crude proxy.
  const t = page.totalDurationMs;
  if (t > 5000) {
    score -= 30;
    findings.push({
      severity: "high",
      title: `Slow response: ${t}ms total`,
      detail: "Above 3s, mobile users start abandoning. Above 5s, conversion drops measurably.",
    });
  } else if (t > 2500) {
    score -= 15;
    findings.push({
      severity: "medium",
      title: `Response is slow: ${t}ms total`,
      detail: "Aim for under 2 seconds end-to-end for the average page.",
    });
  } else if (t > 1200) {
    score -= 6;
    findings.push({
      severity: "low",
      title: `Response is okay-not-great: ${t}ms total`,
    });
  } else {
    findings.push({
      severity: "info",
      title: `Response time: ${t}ms total`,
    });
  }

  // Page weight from the truncated body — only meaningful when not truncated.
  if (!page.bodyTruncated) {
    const bytes = new TextEncoder().encode(page.bodyText).byteLength;
    const kb = Math.round(bytes / 1024);
    if (bytes > 500_000) {
      score -= 10;
      findings.push({
        severity: "medium",
        title: `HTML payload is heavy: ${kb} KB`,
        detail: "A typical landing page should be under 100 KB of HTML before assets.",
      });
    } else {
      findings.push({
        severity: "info",
        title: `HTML payload: ${kb} KB`,
      });
    }
  } else {
    findings.push({
      severity: "low",
      title: "HTML payload is over 1 MB (we capped scanning)",
      detail: "Very large initial HTML hurts time-to-interactive across the board.",
    });
    score -= 12;
  }

  // Compression
  const enc = page.headers["content-encoding"]?.toLowerCase();
  if (!enc) {
    score -= 8;
    findings.push({
      severity: "medium",
      title: "Response is not compressed",
      detail: "Enable Brotli or Gzip at your CDN/origin to cut transfer size 60–80%.",
    });
  } else {
    findings.push({
      severity: "info",
      title: `Response compressed with ${enc}`,
    });
  }

  // Caching
  const cache = page.headers["cache-control"];
  if (!cache) {
    score -= 4;
    findings.push({
      severity: "low",
      title: "No Cache-Control header",
    });
  }

  // Optional: real Lighthouse via PSI
  const psi = await runPsi(page.finalUrl);
  if (psi) {
    findings.push({
      severity: "info",
      title: `Google Lighthouse Performance: ${Math.round(psi * 100)}`,
    });
    // Blend: 60% PSI, 40% heuristic
    score = Math.round(score * 0.4 + psi * 100 * 0.6);
  }

  const finalScore = clampScore(score);
  return {
    id: "performance",
    name: "Performance",
    score: finalScore,
    grade: gradeFromScore(finalScore),
    status: statusFromScore(finalScore),
    summary:
      finalScore >= 90
        ? "Page loads quickly and is well-tuned."
        : finalScore >= 70
          ? "Loads okay but has clear wins available."
          : "Slow page — visitors are bouncing.",
    findings,
    durationMs: Date.now() - start,
  };
}

async function runPsi(url: string): Promise<number | null> {
  const key = process.env.PSI_API_KEY;
  if (!key) return null;
  try {
    const psiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    psiUrl.searchParams.set("url", url);
    psiUrl.searchParams.set("key", key);
    psiUrl.searchParams.set("strategy", "mobile");
    psiUrl.searchParams.set("category", "performance");
    const res = await fetch(psiUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number } } };
    };
    const score = data.lighthouseResult?.categories?.performance?.score;
    return typeof score === "number" ? score : null;
  } catch {
    return null;
  }
}
