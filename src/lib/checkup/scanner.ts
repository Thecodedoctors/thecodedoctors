import { validateAndResolve, CheckupValidationError } from "./url-validation";
import { fetchPage } from "./fetcher";
import { checkTransport } from "./checks/transport";
import { checkSecurityHeaders } from "./checks/security-headers";
import { checkSeo } from "./checks/seo";
import { checkDns } from "./checks/dns";
import { checkPrivacy } from "./checks/privacy";
import { checkPerformance } from "./checks/performance";
import type { CheckupReport, CheckResult } from "./types";
import { clampScore, gradeFromScore, statusFromScore } from "./scoring";

export { CheckupValidationError } from "./url-validation";

/**
 * Run a full checkup on a URL and return an aggregated report.
 * Throws CheckupValidationError on bad input or unreachable host.
 */
export async function runCheckup(rawUrl: string): Promise<CheckupReport> {
  const start = Date.now();
  const { url } = await validateAndResolve(rawUrl);

  const page = await fetchPage(url);

  // Re-validate the *final* URL after redirects to catch open-redirect SSRF.
  const finalUrl = new URL(page.finalUrl);
  await validateAndResolve(finalUrl.toString());

  const checks = await Promise.all<CheckResult>([
    Promise.resolve(checkTransport(page)),
    Promise.resolve(checkSecurityHeaders(page)),
    checkSeo(page),
    checkDns(finalUrl.hostname),
    Promise.resolve(checkPrivacy(page)),
    checkPerformance(page),
  ]);

  // Weighted aggregate. Security gets the heaviest weight because it's our
  // brand promise; performance is next because it's the most user-visible.
  const weights: Record<string, number> = {
    "security-headers": 25,
    transport: 20,
    performance: 20,
    seo: 15,
    dns: 15,
    privacy: 5,
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedSum = checks.reduce(
    (sum, c) => sum + c.score * (weights[c.id] ?? 10),
    0
  );
  const overallScore = clampScore(weightedSum / totalWeight);

  return {
    url: rawUrl,
    finalUrl: page.finalUrl,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    overallStatus: statusFromScore(overallScore),
    checks,
  };
}

/** Maps a CheckupValidationError code to a user-facing message + HTTP status. */
export function validationErrorResponse(err: CheckupValidationError) {
  const status =
    err.code === "private" || err.code === "scheme" ? 422 : 400;
  return { status, body: { error: err.code, message: err.message } };
}
