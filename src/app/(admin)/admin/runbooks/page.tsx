import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ArrowRight, BookOpen } from "lucide-react";
import { Section } from "@/components/ui/section";
import { listRunbooks } from "@/content/runbooks";

export const metadata: Metadata = {
  title: "Runbooks · Practice",
  robots: { index: false, follow: false },
};

export default function RunbooksPage() {
  const runbooks = listRunbooks();

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Runbooks
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Doctor procedures
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          The standing operations for triage, incidents, urgent
          response, and onboarding. Read once when you join, refer back
          when something happens.
        </p>
      </div>

      <ul className="mt-10 space-y-4">
        {runbooks.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/runbooks/${r.slug}`}
              className="group block rounded-2xl border border-border bg-surface/40 p-6 transition-colors hover:border-signal/40 hover:bg-surface/60"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {r.title}
                </h2>
                {r.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-signal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-signal ring-1 ring-inset ring-signal/30"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                {r.summary}
              </p>
              <div className="mt-4 flex items-center gap-3 font-mono text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {r.readingMinutes} min read
                </span>
                <span>·</span>
                <span>
                  Updated{" "}
                  {new Date(r.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-signal transition-transform group-hover:translate-x-0.5">
                  Read
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {runbooks.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface text-muted ring-1 ring-inset ring-border">
            <BookOpen className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm text-muted">
            No runbooks published yet.
          </p>
        </div>
      )}
    </Section>
  );
}
