import type { ComponentType } from "react";
import {
  meta as triageMeta,
  Article as TriageArticle,
} from "./triage-new-request";
import {
  meta as siteDownMeta,
  Article as SiteDownArticle,
} from "./site-down-recovery";
import {
  meta as urgentMeta,
  Article as UrgentArticle,
} from "./handling-urgent";
import {
  meta as onboardingMeta,
  Article as OnboardingArticle,
} from "./new-patient-first-day";

export type RunbookMeta = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  updatedAt: string;
  readingMinutes: number;
};

export type RunbookEntry = RunbookMeta & {
  Component: ComponentType;
};

const ENTRIES: RunbookEntry[] = [
  { ...triageMeta, Component: TriageArticle },
  { ...urgentMeta, Component: UrgentArticle },
  { ...siteDownMeta, Component: SiteDownArticle },
  { ...onboardingMeta, Component: OnboardingArticle },
];

export function listRunbooks(): RunbookMeta[] {
  return ENTRIES.map((e) => ({
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    tags: e.tags,
    updatedAt: e.updatedAt,
    readingMinutes: e.readingMinutes,
  })).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getRunbook(slug: string): RunbookEntry | null {
  return ENTRIES.find((r) => r.slug === slug) ?? null;
}
