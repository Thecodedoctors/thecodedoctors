import type { CheckResult, Finding } from "../types";
import { clampScore, gradeFromScore, statusFromScore } from "../scoring";
import type { FetchedPage } from "../fetcher";

export function checkTransport(page: FetchedPage): CheckResult {
  const start = Date.now();
  const findings: Finding[] = [];
  let score = 100;

  const finalIsHttps = page.finalUrl.startsWith("https://");

  if (!finalIsHttps) {
    score -= 60;
    findings.push({
      severity: "critical",
      title: "Site is served over plain HTTP",
      detail:
        "Traffic is unencrypted. Browsers mark it as 'Not Secure' and modern features (geolocation, service workers, OAuth) refuse to work over HTTP.",
    });
  } else {
    findings.push({
      severity: "info",
      title: "Site is served over HTTPS",
    });
  }

  if (!page.initialWasHttps && page.upgradedToHttps) {
    findings.push({
      severity: "low",
      title: "HTTP request was redirected to HTTPS",
      detail:
        "Good — but for stronger protection, set up HSTS so browsers never request HTTP at all.",
    });
  }

  const hsts = page.headers["strict-transport-security"];
  if (finalIsHttps) {
    if (!hsts) {
      score -= 25;
      findings.push({
        severity: "high",
        title: "HSTS header is missing",
        detail:
          "Strict-Transport-Security tells browsers to always use HTTPS for your domain. Without it, users are vulnerable to downgrade attacks.",
      });
    } else {
      const lower = hsts.toLowerCase();
      const maxAgeMatch = lower.match(/max-age\s*=\s*(\d+)/);
      const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 0;
      const includesSubdomains = lower.includes("includesubdomains");
      const preload = lower.includes("preload");

      if (maxAge < 15768000) {
        score -= 12;
        findings.push({
          severity: "medium",
          title: `HSTS max-age is below 6 months (${maxAge}s)`,
          detail:
            "Recommended minimum is 31536000 (1 year). Preload list submission requires 31536000 + includeSubDomains + preload.",
        });
      }
      if (!includesSubdomains) {
        score -= 8;
        findings.push({
          severity: "medium",
          title: "HSTS is missing includeSubDomains",
          detail: "Subdomains can still be reached over HTTP without this directive.",
        });
      }
      if (!preload) {
        findings.push({
          severity: "low",
          title: "HSTS is not flagged for preload",
          detail:
            "Add `preload` and submit your domain at hstspreload.org for built-in browser protection.",
        });
      }
      if (maxAge >= 31536000 && includesSubdomains && preload) {
        findings.push({
          severity: "info",
          title: "HSTS is preload-eligible",
        });
      }
    }
  }

  if (page.headers["server"]) {
    score -= 4;
    findings.push({
      severity: "low",
      title: `Server header leaks software identity: ${page.headers["server"]}`,
      detail: "Strip it at the proxy / framework level — attackers use it to target known CVEs.",
    });
  }
  if (page.headers["x-powered-by"]) {
    score -= 4;
    findings.push({
      severity: "low",
      title: `X-Powered-By header leaks framework: ${page.headers["x-powered-by"]}`,
    });
  }

  const finalScore = clampScore(score);
  return {
    id: "transport",
    name: "Transport & TLS",
    score: finalScore,
    grade: gradeFromScore(finalScore),
    status: statusFromScore(finalScore),
    summary: finalIsHttps
      ? hsts
        ? "HTTPS in place; HSTS configured."
        : "HTTPS in place, but HSTS is missing."
      : "Site is not on HTTPS — this is the highest-priority fix.",
    findings,
    durationMs: Date.now() - start,
  };
}
