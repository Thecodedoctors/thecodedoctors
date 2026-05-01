import type { Grade, Status } from "./types";

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
