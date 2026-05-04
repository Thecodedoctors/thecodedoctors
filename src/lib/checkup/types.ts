export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Status = "healthy" | "needs-attention" | "critical";
export type Grade = "A+" | "A" | "B" | "C" | "D" | "F";

export type Finding = {
  severity: Severity;
  title: string;
  detail?: string;
};

export type CheckResult = {
  id: CheckId;
  name: string;
  score: number; // 0-100
  grade: Grade;
  status: Status;
  summary: string;
  /** One-line verdict that escalates urgency at lower grades — "we need
   *  to fix this today" at F, "keep it up" at A+. Lead-gen leverage. */
  verdict?: string;
  findings: Finding[];
  durationMs: number;
};

export type CheckId =
  | "transport"
  | "security-headers"
  | "seo"
  | "dns"
  | "privacy"
  | "performance";

export type CheckupReport = {
  url: string;
  finalUrl: string;
  scannedAt: string; // ISO
  durationMs: number;
  overallScore: number;
  overallGrade: Grade;
  overallStatus: Status;
  /** Single-word remark on the overall grade — "Poor", "Fair", "Good", etc. */
  overallRemark: string;
  /** Two-sentence verdict the patient sees on the overall card. Tone
   *  escalates with severity — light at A+, urgent at F. */
  overallVerdict: string;
  checks: CheckResult[];
};

export type CheckupRequest = {
  url: string;
  turnstileToken?: string;
};
