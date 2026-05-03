import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Section } from "@/components/ui/section";
import { listPublishedReportsForCurrentUser } from "@/server/monthly-reports";
import { formatRelativeAgo, formatAbsolute } from "@/lib/time";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export default async function PatientReportsPage() {
  const reports = await listPublishedReportsForCurrentUser();

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Reports
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {reports.length === 0
            ? "No reports yet"
            : "Your monthly reports"}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          {reports.length === 0
            ? "Your first monthly report from your doctor will appear here when it's ready — and we'll email you a link too."
            : "Each one covers what we treated, what's healthy, and what's next. We email you a link when a new one's ready."}
        </p>

        {reports.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
              <FileText className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm text-foreground">
              Your doctor is still in the first cycle.
            </p>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface/80"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-foreground">
                      {r.title}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted">
                      Published {formatRelativeAgo(r.publishedAt)}
                      {r.authorName && <> · {r.authorName}</>}
                    </p>
                  </div>
                  <time
                    className="hidden sm:inline font-mono text-xs text-muted"
                    title={formatAbsolute(r.publishedAt)}
                  >
                    {r.publishedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
