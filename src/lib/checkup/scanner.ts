import { validateAndResolve, CheckupValidationError } from "./url-validation";
import { fetchPage } from "./fetcher";
import { checkTransport } from "./checks/transport";
import { checkSecurityHeaders } from "./checks/security-headers";
import { checkSeo } from "./checks/seo";
import { checkDns } from "./checks/dns";
import { checkPrivacy } from "./checks/privacy";
import { checkPerformance } from "./checks/performance";
import type { CheckupReport, CheckResult } from "./types";
import {
  clampScore,
  gradeFromScore,
  statusFromScore,
  remarkForGrade,
  verdictForOverall,
  verdictForCheck,
} from "./scoring";

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

  const rawChecks = await Promise.all<CheckResult>([
    Promise.resolve(checkTransport(page)),
    Promise.resolve(checkSecurityHeaders(page)),
    checkSeo(page),
    checkDns(finalUrl.hostname),
    Promise.resolve(checkPrivacy(page)),
    checkPerformance(page),
  ]);

  // Attach a per-check verdict ("attackers love scores like this" at F,
  // "keep it up" at A+) so each card carries its own urgency message.
  const checks = rawChecks.map((c) => ({
    ...c,
    verdict: verdictForCheck(c.id, c.score),
  }));

  // Overall score = the LOWEST sub-score. A site is only as healthy
  // as its weakest area, and this framing creates honest urgency on
  // the lead-gen Checkup: a site with one weak section gets graded by
  // that section, not averaged into mediocrity. Honest because the
  // weakest area really is the one that hurts the site's visitors.
  const overallScore = checks.reduce(
    (lowest, c) => Math.min(lowest, clampScore(c.score)),
    100
  );
  const overallGrade = gradeFromScore(overallScore);

  return {
    url: rawUrl,
    finalUrl: page.finalUrl,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    overallScore,
    overallGrade,
    overallStatus: statusFromScore(overallScore),
    overallRemark: remarkForGrade(overallGrade),
    overallVerdict: verdictForOverall(overallScore),
    checks,
  };
}

/** Maps a CheckupValidationError code to a user-facing message + HTTP status. */
export function validationErrorResponse(err: CheckupValidationError) {
  const status =
    err.code === "private" || err.code === "scheme" ? 422 : 400;
  return { status, body: { error: err.code, message: err.message } };
}
