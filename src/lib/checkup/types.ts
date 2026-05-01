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
  checks: CheckResult[];
};

export type CheckupRequest = {
  url: string;
  turnstileToken?: string;
};
