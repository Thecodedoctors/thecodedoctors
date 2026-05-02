import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { Section } from "@/components/ui/section";
import { getArticle, listArticles } from "@/content/knowledge";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return { title: "Article not found" };
  return {
    title: a.title,
    description: a.summary,
    robots: { index: false, follow: false },
  };
}

export async function generateStaticParams() {
  return listArticles().map((a) => ({ slug: a.slug }));
}

export default async function ArticlePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const Body = article.Component;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All articles
        </Link>

        <div className="mt-6">
          <div className="flex flex-wrap items-baseline gap-2">
            {article.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent ring-1 ring-inset ring-accent/20"
              >
                {t}
              </span>
            ))}
          </div>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {article.title}
          </h1>
          <p className="mt-3 text-base text-muted leading-relaxed">
            {article.summary}
          </p>
          <div className="mt-4 flex items-center gap-3 font-mono text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {article.readingMinutes} min read
            </span>
            <span>·</span>
            <span>
              Updated{" "}
              {new Date(article.updatedAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="mt-10">
          <Body />
        </div>

        <div className="mt-16 border-t border-border pt-8">
          <p className="text-sm text-muted">
            Want a doctor on call?{" "}
            <Link
              href="/requests/new"
              className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              Submit a request
            </Link>{" "}
            and we&apos;ll handle it.
          </p>
        </div>
      </div>
    </Section>
  );
}
