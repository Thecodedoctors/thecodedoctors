import type { CheckId, Grade, Status } from "./types";

export function gradeFromScore(score: number): Grade {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function statusFromScore(score: number): Status {
  if (score >= 80) return "healthy";
  if (score >= 50) return "needs-attention";
  return "critical";
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Single-word remark — what shows next to the overall grade, like
 * "B · Good" or "F · Critical". Maps grade → human label.
 */
export function remarkForGrade(grade: Grade): string {
  switch (grade) {
    case "A+":
      return "Excellent";
    case "A":
      return "Strong";
    case "B":
      return "Good";
    case "C":
      return "Fair";
    case "D":
      return "Poor";
    case "F":
      return "Critical";
  }
}

/**
 * Two-sentence verdict for the overall card — escalates urgency at
 * lower grades. The Free Checkup is our lead-gen tool: a site that
 * scores low needs to FEEL the gap so they convert.
 *
 * Honest urgency, not fear-mongering — sites with C or below DO have
 * real measurable problems.
 */
export function verdictForOverall(score: number): string {
  const grade = gradeFromScore(score);
  switch (grade) {
    case "A+":
      return "Excellent. Your site is in great shape — we can help you stay there as the web evolves.";
    case "A":
      return "Strong work. A handful of small refinements would put you at the very top.";
    case "B":
      return "Doing OK, but there's room to push higher. Let us tighten the weak spots.";
    case "C":
      return "Your site needs attention. We can get you to A+ in about 30 days of focused care.";
    case "D":
      return "Your site has serious symptoms. The lowest-scoring area below tells you where to start — and we can fix it this week.";
    case "F":
      return "Your site needs urgent care. Multiple critical issues — let's fix the worst ones today before they cost you customers.";
  }
}

/**
 * Per-check verdict — punchy one-liner shown beneath each check card.
 * Tone matches the check's domain (security headers gets attacker-
 * flavored copy, performance gets revenue-flavored, SEO gets traffic-
 * flavored, etc.) and escalates with the score.
 *
 * "I'm sure you know what to do" was the brief from the founder —
 * channel honest urgency without being slimy. Real problems exist;
 * the messages name them clearly.
 */
export function verdictForCheck(id: CheckId, score: number): string {
  const grade = gradeFromScore(score);
  return CHECK_VERDICTS[id]?.[grade] ?? "";
}

const CHECK_VERDICTS: Record<CheckId, Record<Grade, string>> = {
  "security-headers": {
    "F": "Wide open. Attackers love scores like this — let's lock it down today before someone takes advantage.",
    "D": "Critical security headers are missing. This is exactly what automated attack scanners hunt for daily.",
    "C": "Some hardening is missing. Easy wins available — your visitors deserve the protection.",
    "B": "Solid posture. A few refinements would get you to A.",
    "A": "Strong security headers. Locked down well.",
    "A+": "Bulletproof. Best-in-class header config.",
  },
  transport: {
    "F": "No HTTPS or broken SSL. Browsers will show your visitors a giant red warning — most leave instantly. Fix this now.",
    "D": "Transport security is dangerously weak. Modern browsers will start flagging this to your users any day now.",
    "C": "Workable, but not fully modern. Quick upgrade to close the gap.",
    "B": "Good. Small improvements to lock it tight.",
    "A": "Strong HTTPS posture.",
    "A+": "Best-in-class transport security. Doing this right.",
  },
  seo: {
    "F": "Search engines can barely see this site. You're invisible to Google — and your competitors aren't. Fixable in a week.",
    "D": "Major SEO gaps. Your competitors are probably outranking you on your own brand name.",
    "C": "Some basics missing. Quick wins to climb the rankings.",
    "B": "SEO foundation is solid. We can push this higher with refinement.",
    "A": "Strong SEO posture.",
    "A+": "SEO done right. Keep this up.",
  },
  dns: {
    "F": "Your DNS is dangerously unconfigured. Email spoofing risk is high — attackers can send mail pretending to be you.",
    "D": "Email authentication is missing critical pieces. Phishers can impersonate your domain to your customers.",
    "C": "Partial DNS protection. Let us complete the setup so spoofers can't touch you.",
    "B": "Good email posture. A few refinements would close the gap.",
    "A": "Strong DNS and email protection.",
    "A+": "Locked down. Spoofers can't touch this.",
  },
  privacy: {
    "F": "Your site leaks data to dozens of third-party trackers. GDPR/CCPA exposure is serious — fines start at thousands per visitor.",
    "D": "Heavy third-party tracking detected. Real privacy-law exposure here.",
    "C": "Some tracker bloat. Cleanup will improve trust and speed.",
    "B": "Decent privacy posture. A few refinements possible.",
    "A": "Clean privacy posture.",
    "A+": "Privacy-first. Visitors can trust this site.",
  },
  performance: {
    "F": "Your site is painfully slow. Visitors leave before it finishes loading — costing you revenue every single day.",
    "D": "Performance is hurting conversions. Every second of load time loses about 7% of visitors.",
    "C": "Some optimization opportunities. Quick wins available.",
    "B": "Reasonable performance. Tuning available.",
    "A": "Fast. Keep it up.",
    "A+": "Lightning fast. Best-in-class.",
  },
};
