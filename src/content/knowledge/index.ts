import type { ComponentType } from "react";
import {
  meta as hstsMeta,
  Article as HstsArticle,
} from "./hsts";
import {
  meta as speedMeta,
  Article as SpeedArticle,
} from "./site-speed";
import {
  meta as securityTxtMeta,
  Article as SecurityTxtArticle,
} from "./security-txt";
import {
  meta as workflowMeta,
  Article as WorkflowArticle,
} from "./how-treatment-works";

export type ArticleMeta = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  /** ISO date for the most recent meaningful edit. */
  updatedAt: string;
  /** Approx reading time in minutes. */
  readingMinutes: number;
};

export type ArticleEntry = ArticleMeta & {
  Component: ComponentType;
};

const ENTRIES: ArticleEntry[] = [
  { ...hstsMeta, Component: HstsArticle },
  { ...speedMeta, Component: SpeedArticle },
  { ...securityTxtMeta, Component: SecurityTxtArticle },
  { ...workflowMeta, Component: WorkflowArticle },
];

export function listArticles(): ArticleMeta[] {
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

export function getArticle(slug: string): ArticleEntry | null {
  return ENTRIES.find((a) => a.slug === slug) ?? null;
}
