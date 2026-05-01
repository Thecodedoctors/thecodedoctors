import type { CheckResult, Finding } from "../types";
import { clampScore, gradeFromScore, statusFromScore } from "../scoring";
import type { FetchedPage } from "../fetcher";

/**
 * Heuristic privacy check based on inspecting the HTML body for known
 * trackers and third-party scripts. Not exhaustive, but catches the obvious.
 */
const TRACKERS = [
  { name: "Google Analytics 4", pattern: /googletagmanager\.com\/gtag\/js|gtag\(\s*['"]config['"]|G-[A-Z0-9]{8,}/i, severity: "medium" as const },
  { name: "Google Analytics (UA)", pattern: /UA-\d{4,}-\d+|google-analytics\.com\/analytics\.js/i, severity: "medium" as const },
  { name: "Facebook Pixel", pattern: /connect\.facebook\.net|fbq\(\s*['"]init/i, severity: "medium" as const },
  { name: "Hotjar", pattern: /static\.hotjar\.com|hj\(\s*\)/i, severity: "medium" as const },
  { name: "TikTok Pixel", pattern: /analytics\.tiktok\.com|ttq\.load/i, severity: "medium" as const },
  { name: "LinkedIn Insight", pattern: /snap\.licdn\.com|_linkedin_partner_id/i, severity: "low" as const },
  { name: "Microsoft Clarity", pattern: /clarity\.ms\/tag|clarity\(\s*\)/i, severity: "low" as const },
  { name: "Google Tag Manager", pattern: /googletagmanager\.com\/gtm\.js/i, severity: "low" as const },
];

export function checkPrivacy(page: FetchedPage): CheckResult {
  const start = Date.now();
  const findings: Finding[] = [];
  const html = page.bodyText;
  let score = 100;

  const detected: string[] = [];
  for (const t of TRACKERS) {
    if (t.pattern.test(html)) {
      detected.push(t.name);
      // Each tracker chips away at the score.
      score -= t.severity === "medium" ? 8 : 4;
      findings.push({
        severity: t.severity,
        title: `${t.name} detected`,
        detail: "Each third-party tracker leaks visitor data and adds a privacy/legal burden.",
      });
    }
  }

  if (detected.length === 0) {
    findings.push({
      severity: "info",
      title: "No common third-party trackers detected",
      detail: "Your visitors aren't being shared with ad networks (or they're loaded after page-load — re-test in Phase 2 v2).",
    });
  }

  // Cookie banner heuristic — if we don't see a tracker we don't expect a banner.
  // If we do see one, the absence of a CMP keyword suggests possible compliance gap.
  const lower = html.toLowerCase();
  const hasCookieBannerCue = /cookie\s*(banner|consent|notice|policy)|gdpr|ccpa/i.test(lower);
  if (detected.length > 0 && !hasCookieBannerCue) {
    score -= 8;
    findings.push({
      severity: "medium",
      title: "Trackers present, but no cookie-consent UI detected",
      detail: "Possible GDPR/CCPA compliance gap. We detect cues conservatively — re-check by hand.",
    });
  }

  // Privacy policy link presence
  const hasPolicyLink = /href\s*=\s*["'][^"']*(privacy|privacy-policy|datenschutz)/i.test(html);
  if (!hasPolicyLink) {
    score -= 6;
    findings.push({
      severity: "medium",
      title: "No link to a privacy policy on this page",
    });
  }

  const finalScore = clampScore(score);
  return {
    id: "privacy",
    name: "Privacy & Trackers",
    score: finalScore,
    grade: gradeFromScore(finalScore),
    status: statusFromScore(finalScore),
    summary:
      detected.length === 0
        ? "No third-party trackers detected on this page."
        : `${detected.length} third-party tracker${detected.length === 1 ? "" : "s"} detected.`,
    findings,
    durationMs: Date.now() - start,
  };
}
