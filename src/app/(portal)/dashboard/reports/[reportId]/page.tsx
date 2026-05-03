import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Section } from "@/components/ui/section";
import { getPublishedReportForCurrentUser } from "@/server/monthly-reports";
import { formatAbsolute } from "@/lib/time";

export const metadata: Metadata = {
  title: "Report",
  robots: { index: false, follow: false },
};

export default async function PatientReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const report = await getPublishedReportForCurrentUser(reportId);
  if (!report) notFound();

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All reports
        </Link>

        <div className="mt-6 flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              Report
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              {report.title}
            </h1>
            <p className="mt-2 font-mono text-xs text-muted">
              Published {formatAbsolute(report.publishedAt)}
              {report.authorName && <> · by {report.authorName}</>}
            </p>
          </div>
        </div>

        <article className="mt-8 rounded-2xl border border-border bg-surface/30 p-6 sm:p-8">
          <pre className="whitespace-pre-wrap break-words font-sans text-base leading-relaxed text-foreground">
            {report.body || "(empty)"}
          </pre>
        </article>

        <p className="mt-8 text-xs text-muted">
          Questions about anything in this report? Reply to the email we sent,
          or open a new request — your doctor will see it within a few hours.
        </p>
      </div>
    </Section>
  );
}
