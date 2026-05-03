import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { getClientForStaff } from "@/server/clients";
import {
  listReportsForClientAdmin,
  startNewReport,
} from "@/server/monthly-reports";
import { labelForPeriod } from "@/lib/report-period";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Patient reports · Practice",
  robots: { index: false, follow: false },
};

export default async function PatientReportsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const [client, reports] = await Promise.all([
    getClientForStaff(clientId),
    listReportsForClientAdmin(clientId),
  ]);
  if (!client) notFound();

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-3xl">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All reports
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
              {client.client.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Monthly reports
            </h1>
          </div>
          <form action={startNewReport}>
            <input type="hidden" name="clientId" value={clientId} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
            >
              <Plus className="h-3.5 w-3.5" />
              New report
            </button>
          </form>
        </div>

        <div className="mt-8">
          {reports.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center text-sm text-muted">
              No reports yet for this patient. Click <span className="font-mono">New report</span> to start the first one.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reports/${clientId}/edit/${r.id}`}
                    className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface/80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-base font-medium text-foreground">
                          {r.title || labelForPeriod(r.periodStart)}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                            r.publishedAt
                              ? "bg-success/10 text-success ring-success/30"
                              : "bg-warning/10 text-warning ring-warning/30"
                          )}
                        >
                          {r.publishedAt ? (
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
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted">
                        {r.publishedAt
                          ? `Published ${formatRelativeAgo(r.publishedAt)}`
                          : `Updated ${formatRelativeAgo(r.updatedAt)}`}
                        {r.authorName && <> · {r.authorName}</>}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
