import type { CheckResult, Finding } from "../types";
import { clampScore, gradeFromScore, statusFromScore } from "../scoring";
import type { FetchedPage } from "../fetcher";

const META_TAG = /<meta\s+([^>]+)>/gi;
const ATTR = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*'([^']*)'/g;

function extractMetaTags(html: string): Array<Record<string, string>> {
  const tags: Array<Record<string, string>> = [];
  for (const match of html.matchAll(META_TAG)) {
    const attrs: Record<string, string> = {};
    for (const a of match[1].matchAll(ATTR)) {
      const key = (a[1] || a[3] || "").toLowerCase();
      const val = a[2] ?? a[4] ?? "";
      if (key) attrs[key] = val;
    }
    tags.push(attrs);
  }
  return tags;
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.trim();
}

function extractFirstAttr(html: string, tag: string, attr: string): string | undefined {
  const re = new RegExp(`<${tag}\\s+[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["']`, "i");
  return html.match(re)?.[1];
}

export async function checkSeo(page: FetchedPage): Promise<CheckResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  let score = 100;
  const html = page.bodyText;

  const title = extractTitle(html);
  if (!title) {
    score -= 18;
    findings.push({
      severity: "high",
      title: "Page is missing a <title>",
    });
  } else if (title.length < 10) {
    score -= 8;
    findings.push({
      severity: "medium",
      title: `<title> is very short: "${title}"`,
    });
  } else if (title.length > 70) {
    score -= 4;
    findings.push({
      severity: "low",
      title: `<title> is over 70 chars (${title.length})`,
      detail: "Search engines truncate longer titles in results.",
    });
  } else {
    findings.push({ severity: "info", title: `<title>: "${title}"` });
  }

  const metas = extractMetaTags(html);
  const description = metas.find((m) => m.name === "description")?.content;
  if (!description) {
    score -= 12;
    findings.push({
      severity: "high",
      title: "Page is missing meta description",
    });
  } else if (description.length < 50 || description.length > 160) {
    score -= 4;
    findings.push({
      severity: "low",
      title: `Meta description length is ${description.length} chars`,
      detail: "Aim for 80–160 characters for the best snippet display.",
    });
  } else {
    findings.push({ severity: "info", title: "Meta description is set" });
  }

  const viewport = metas.find((m) => m.name === "viewport")?.content;
  if (!viewport) {
    score -= 14;
    findings.push({
      severity: "high",
      title: "No mobile viewport meta tag",
      detail: "Mobile browsers will render your site at desktop width and zoom out.",
    });
  } else {
    findings.push({ severity: "info", title: "Viewport meta tag set" });
  }

  const canonical = extractFirstAttr(html, "link", "rel")
    ? html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i)
    : null;
  if (!canonical) {
    score -= 6;
    findings.push({
      severity: "medium",
      title: "No canonical URL declared",
      detail: "Helps search engines pick the authoritative URL when content is reachable from multiple paths.",
    });
  }

  const og =
    metas.find((m) => m.property === "og:title")?.content ??
    metas.find((m) => m.name === "og:title")?.content;
  if (!og) {
    score -= 6;
    findings.push({
      severity: "low",
      title: "No Open Graph metadata",
      detail: "Links to your site shared on Slack/X/Facebook will look bland.",
    });
  } else {
    findings.push({ severity: "info", title: "Open Graph title set" });
  }

  // Robots / sitemap probe — fire-and-forget alongside main checks.
  const origin = new URL(page.finalUrl).origin;
  const [robotsOk, sitemapOk] = await Promise.all([
    headOk(origin + "/robots.txt"),
    headOk(origin + "/sitemap.xml"),
  ]);
  if (!robotsOk) {
    score -= 4;
    findings.push({
      severity: "low",
      title: "robots.txt is missing",
      detail: "Add one even if you allow everything — search engines expect it.",
    });
  }
  if (!sitemapOk) {
    score -= 4;
    findings.push({
      severity: "low",
      title: "sitemap.xml is missing",
      detail: "A sitemap helps crawlers discover deep pages, especially for new sites.",
    });
  }

  const finalScore = clampScore(score);
  return {
    id: "seo",
    name: "SEO & Discoverability",
    score: finalScore,
    grade: gradeFromScore(finalScore),
    status: statusFromScore(finalScore),
    summary:
      finalScore >= 90
        ? "Search-ready and well-tagged."
        : finalScore >= 70
          ? "Mostly fine, with a few gaps."
          : "Several SEO basics are missing.",
    findings,
    durationMs: Date.now() - start,
  };
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
      headers: { "User-Agent": "TheCodeDoctors-Checkup/0.1" },
    });
    return res.ok;
  } catch {
    return false;
  }
}
