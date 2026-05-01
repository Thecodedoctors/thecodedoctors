import { promises as dns } from "node:dns";
import type { CheckResult, Finding } from "../types";
import { clampScore, gradeFromScore, statusFromScore } from "../scoring";

/**
 * Apex-domain DNS posture check: SPF, DMARC, CAA, MX presence.
 * DNSSEC and DKIM are out of scope for v1 (require lower-level DNS or selector
 * discovery).
 */
export async function checkDns(hostname: string): Promise<CheckResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  let score = 100;

  const apex = apexDomain(hostname);

  const [spfRecord, dmarcRecord, caaRecords, mxRecords] = await Promise.all([
    fetchTxt(apex).then((records) => records.find((r) => r.toLowerCase().startsWith("v=spf1"))),
    fetchTxt(`_dmarc.${apex}`).then((records) =>
      records.find((r) => r.toLowerCase().startsWith("v=dmarc1"))
    ),
    safe(() => dns.resolveCaa(apex)),
    safe(() => dns.resolveMx(apex)),
  ]);

  if (!spfRecord) {
    score -= 18;
    findings.push({
      severity: "high",
      title: "No SPF record",
      detail: "Without SPF, attackers can spoof email from your domain.",
    });
  } else {
    findings.push({ severity: "info", title: "SPF record published" });
    if (spfRecord.toLowerCase().includes("+all")) {
      score -= 12;
      findings.push({
        severity: "high",
        title: "SPF policy ends with `+all` (allows everyone)",
      });
    } else if (spfRecord.toLowerCase().includes("?all")) {
      score -= 4;
      findings.push({
        severity: "low",
        title: "SPF policy ends with `?all` (neutral)",
        detail: "Tighten to `~all` (soft fail) or `-all` (hard fail).",
      });
    }
  }

  if (!dmarcRecord) {
    score -= 22;
    findings.push({
      severity: "high",
      title: "No DMARC record",
      detail:
        "DMARC tells receiving mail servers what to do with messages that fail SPF/DKIM. Cold-outreach deliverability suffers without it.",
    });
  } else {
    findings.push({ severity: "info", title: "DMARC record published" });
    const policyMatch = dmarcRecord.match(/p\s*=\s*(\w+)/i);
    const policy = policyMatch?.[1]?.toLowerCase();
    if (!policy || policy === "none") {
      score -= 8;
      findings.push({
        severity: "medium",
        title: "DMARC policy is `none`",
        detail: "Move to `quarantine` once stable, then `reject` for full protection.",
      });
    }
  }

  if (!caaRecords || caaRecords.length === 0) {
    score -= 6;
    findings.push({
      severity: "low",
      title: "No CAA records",
      detail:
        "CAA tells browsers which certificate authorities are allowed to issue certs for your domain. Without it, any CA can.",
    });
  } else {
    findings.push({ severity: "info", title: `CAA records present (${caaRecords.length})` });
  }

  if (!mxRecords || mxRecords.length === 0) {
    findings.push({
      severity: "info",
      title: "No MX records — domain doesn't accept email",
    });
  }

  const finalScore = clampScore(score);
  return {
    id: "dns",
    name: "DNS & Email Posture",
    score: finalScore,
    grade: gradeFromScore(finalScore),
    status: statusFromScore(finalScore),
    summary:
      finalScore >= 90
        ? "Email anti-spoofing is in good shape."
        : finalScore >= 70
          ? "Most pieces in place; one or two to add."
          : "Email spoofing protection has serious gaps.",
    findings,
    durationMs: Date.now() - start,
  };
}

async function fetchTxt(host: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(host);
    return records.map((parts) => parts.join(""));
  } catch {
    return [];
  }
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * Extract a sensible apex domain. Naive: takes the last two labels for
 * common TLDs, last three for common multipart TLDs (co.uk, com.au, etc).
 */
function apexDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const last2 = parts.slice(-2).join(".");
  const last3 = parts.slice(-3).join(".");
  // Common second-level TLDs that need 3 labels for the apex
  const multipart = [
    "co.uk", "co.jp", "co.kr", "co.in", "co.za", "co.nz",
    "com.au", "com.br", "com.cn", "com.mx", "com.tr", "com.tw", "com.hk", "com.sg",
    "ac.uk", "gov.uk", "org.uk",
    "net.au", "org.au",
  ];
  if (multipart.some((m) => last2 === m || hostname.endsWith("." + m))) {
    return last3;
  }
  return last2;
}
