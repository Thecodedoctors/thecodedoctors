import type { CheckResult, Finding } from "../types";
import { clampScore, gradeFromScore, statusFromScore } from "../scoring";
import type { FetchedPage } from "../fetcher";

const REQUIRED = [
  {
    name: "Content-Security-Policy",
    weight: 25,
    why: "Blocks XSS by restricting which sources the browser will load scripts, styles, and iframes from.",
  },
  {
    name: "X-Content-Type-Options",
    expect: "nosniff",
    weight: 8,
    why: "Stops browsers from MIME-sniffing responses and executing them as scripts.",
  },
  {
    name: "X-Frame-Options",
    weight: 8,
    why: "Prevents clickjacking via iframe embedding. Use DENY or SAMEORIGIN.",
    alternativeCsp: "frame-ancestors",
  },
  {
    name: "Referrer-Policy",
    weight: 6,
    why: "Limits the data leaked to other sites in the Referer header.",
  },
  {
    name: "Permissions-Policy",
    weight: 6,
    why: "Locks down powerful browser features (camera, mic, geolocation) for unused features.",
  },
  {
    name: "Cross-Origin-Opener-Policy",
    weight: 4,
    why: "Required for some isolated browser features and prevents window references from cross-origin pages.",
  },
];

export function checkSecurityHeaders(page: FetchedPage): CheckResult {
  const start = Date.now();
  const findings: Finding[] = [];
  let score = 100;

  for (const h of REQUIRED) {
    const value = page.headers[h.name.toLowerCase()];
    if (!value) {
      // CSP frame-ancestors substitutes for X-Frame-Options
      if (h.alternativeCsp) {
        const csp = page.headers["content-security-policy"];
        if (csp && csp.toLowerCase().includes(h.alternativeCsp)) {
          findings.push({
            severity: "info",
            title: `${h.name} is missing — but covered by CSP \`${h.alternativeCsp}\``,
          });
          continue;
        }
      }
      score -= h.weight;
      findings.push({
        severity: h.weight >= 20 ? "high" : "medium",
        title: `${h.name} header is missing`,
        detail: h.why,
      });
      continue;
    }

    if (h.expect && !value.toLowerCase().includes(h.expect.toLowerCase())) {
      score -= h.weight / 2;
      findings.push({
        severity: "low",
        title: `${h.name} should be \`${h.expect}\``,
        detail: `Found: ${value}`,
      });
      continue;
    }

    findings.push({
      severity: "info",
      title: `${h.name} is set`,
    });
  }

  // CSP detail — penalise unsafe-inline / unsafe-eval in script-src.
  const csp = page.headers["content-security-policy"];
  if (csp) {
    const lower = csp.toLowerCase();
    if (/script-src[^;]*'unsafe-inline'/.test(lower)) {
      score -= 6;
      findings.push({
        severity: "medium",
        title: "CSP allows unsafe-inline scripts",
        detail: "This largely defeats CSP's XSS protection. Migrate to nonce-based or hash-based scripts.",
      });
    }
    if (/script-src[^;]*'unsafe-eval'/.test(lower)) {
      score -= 4;
      findings.push({
        severity: "low",
        title: "CSP allows unsafe-eval",
        detail: "Disable eval() and dynamic Function() to harden against code-injection.",
      });
    }
  }

  const finalScore = clampScore(score);
  return {
    id: "security-headers",
    name: "Security Headers",
    score: finalScore,
    grade: gradeFromScore(finalScore),
    status: statusFromScore(finalScore),
    summary:
      finalScore >= 90
        ? "Strong header posture."
        : finalScore >= 70
          ? "Decent posture — a few gaps to close."
          : finalScore >= 40
            ? "Multiple critical headers are missing."
            : "Most security headers are missing — XSS and clickjacking risk is high.",
    findings,
    durationMs: Date.now() - start,
  };
}
