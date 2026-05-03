import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Save,
  Trash2,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  getReportForStaff,
  saveReportDraft,
  publishReport,
  deleteReportDraft,
} from "@/server/monthly-reports";
import { labelForPeriod } from "@/lib/report-period";
import { formatAbsolute } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Edit report · Practice",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ published?: string }>;

export default async function EditReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; reportId: string }>;
  searchParams: SearchParams;
}) {
  const { clientId, reportId } = await params;
  const sp = await searchParams;
  const report = await getReportForStaff(reportId);
  if (!report || report.clientId !== clientId) notFound();

  const isPublished = Boolean(report.publishedAt);
  const periodLabel = labelForPeriod(report.periodStart);

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/reports/${clientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {report.clientName}&apos;s reports
        </Link>

        {sp.published === "1" && (
          <div className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
              Report published
            </p>
            <p className="mt-2 text-sm text-foreground">
              The patient&apos;s primary contact has been emailed with a link
              to read it.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
              {report.clientName}
            </p>
            <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-3xl font-semibold tracking-tight md:text-4xl">
              {report.title || periodLabel}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                  isPublished
                    ? "bg-success/10 text-success ring-success/30"
                    : "bg-warning/10 text-warning ring-warning/30"
                )}
              >
                {isPublished ? (
                  <>
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Published
                  </>
                ) : (
                  <>
                    <Pencil className="h-2.5 w-2.5" />
                    Draft
                  </>
                )}
              </span>
            </h1>
            <p className="mt-2 font-mono text-xs text-muted">
              Period: {periodLabel}
              {report.publishedAt && (
                <> · Sent {formatAbsolute(report.publishedAt)}</>
              )}
            </p>
          </div>
        </div>

        {isPublished ? (
          <PublishedView title={report.title || periodLabel} body={report.body} />
        ) : (
          <DraftEditor
            reportId={reportId}
            title={report.title}
            body={report.body}
          />
        )}
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function DraftEditor({
  reportId,
  title,
  body,
}: {
  reportId: string;
  title: string;
  body: string;
}) {
  return (
    <form
      action={publishReport}
      className="mt-8 space-y-5 rounded-2xl border border-border bg-surface/30 p-6"
    >
      <input type="hidden" name="reportId" value={reportId} />

      <label className="block">
        <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Title
        </span>
        <input
          type="text"
          name="title"
          defaultValue={title}
          maxLength={200}
          placeholder="Defaults to the month, e.g. April 2026"
          className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
        />
      </label>

      <label className="block">
        <span className="mb-2 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          <span>Body</span>
          <span className="text-[10px] normal-case tracking-normal">
            Markdown — headings, bold, lists, links
          </span>
        </span>
        <textarea
          name="body"
          defaultValue={body}
          rows={18}
          maxLength={30_000}
          placeholder={EXAMPLE_BODY}
          className="w-full resize-y rounded-lg bg-background px-3 py-3 font-mono text-sm leading-relaxed text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-signal/90"
        >
          <Send className="h-3.5 w-3.5" />
          Publish &amp; email patient
        </button>
        <button
          type="submit"
          formAction={saveReportDraft}
          className="inline-flex items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-foreground hover:text-foreground"
        >
          <Save className="h-3.5 w-3.5" />
          Save draft
        </button>
        <button
          type="submit"
          formAction={deleteReportDraft}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-signal/30 px-3 py-2 text-xs font-medium text-signal transition-colors hover:bg-signal/10"
        >
          <Trash2 className="h-3 w-3" />
          Delete draft
        </button>
      </div>

      <p className="text-xs text-muted">
        Once you publish, the body is locked and the patient&apos;s primary
        contact gets an email with a link.
      </p>
    </form>
  );
}

function PublishedView({ title, body }: { title: string; body: string }) {
  return (
    <article className="mt-8 rounded-2xl border border-border bg-surface/30 p-6">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
        {body || "(empty)"}
      </pre>
      <p className="mt-6 text-xs text-muted">
        Published reports are read-only on the patient side and here. Start a
        new report from the patient&apos;s reports list to cover a different
        period.
      </p>
    </article>
  );
}

const EXAMPLE_BODY = `## What we treated this month
- Fixed: the contact form was sending to the wrong inbox (root cause: ENV split between staging and prod).
- Updated: WordPress core, Yoast, and 3 other plugins; tested checkout afterwards.
- Hardened: enabled HSTS preload + tightened CSP for marketing pages.

## What's healthy
- Uptime: 99.97% across the month (one 4-minute window during a host-side reboot).
- Security headers: A grade. SSL renews automatically on Aug 30.

## What we recommend next month
- Migrate the blog from a child-theme tweak to a proper plugin so updates stop overwriting.
- Add a fallback contact email so a single inbox outage can't lose leads.
`;
