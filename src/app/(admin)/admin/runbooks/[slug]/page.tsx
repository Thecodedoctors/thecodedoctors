import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { Section } from "@/components/ui/section";
import { getRunbook, listRunbooks } from "@/content/runbooks";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = getRunbook(slug);
  if (!r) return { title: "Runbook not found" };
  return {
    title: `${r.title} · Runbook`,
    description: r.summary,
    robots: { index: false, follow: false },
  };
}

export async function generateStaticParams() {
  return listRunbooks().map((r) => ({ slug: r.slug }));
}

export default async function RunbookPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const runbook = getRunbook(slug);
  if (!runbook) notFound();
  const Body = runbook.Component;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/runbooks"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All runbooks
        </Link>

        <div className="mt-6">
          <div className="flex flex-wrap items-baseline gap-2">
            {runbook.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-signal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-signal ring-1 ring-inset ring-signal/30"
              >
                {t}
              </span>
            ))}
          </div>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {runbook.title}
          </h1>
          <p className="mt-3 text-base text-muted leading-relaxed">
            {runbook.summary}
          </p>
          <div className="mt-4 flex items-center gap-3 font-mono text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {runbook.readingMinutes} min read
            </span>
            <span>·</span>
            <span>
              Updated{" "}
              {new Date(runbook.updatedAt).toLocaleDateString(undefined, {
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
      </div>
    </Section>
  );
}
