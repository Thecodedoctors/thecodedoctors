import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  RotateCcw,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  getIncidentForStaff,
  updateIncident,
  resolveIncident,
  reopenIncident,
  deleteIncident,
} from "@/server/incidents";
import { formatAbsolute, formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Edit incident · Practice",
  robots: { index: false, follow: false },
};

const SEVERITY_CLS: Record<string, string> = {
  critical: "bg-signal/10 text-signal ring-signal/30",
  major: "bg-warning/10 text-warning ring-warning/30",
  minor: "bg-muted/10 text-muted ring-muted/20",
};

export default async function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const incident = await getIncidentForStaff(id);
  if (!incident) notFound();

  const isOpen = !incident.resolvedAt;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All incidents
        </Link>

        <div className="mt-6 flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {incident.title}
          </h1>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
              SEVERITY_CLS[incident.severity] ?? SEVERITY_CLS.minor
            )}
          >
            {incident.severity}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
              isOpen
                ? "bg-signal/10 text-signal ring-signal/30"
                : "bg-success/10 text-success ring-success/30"
            )}
          >
            {isOpen ? "Open" : "Resolved"}
          </span>
        </div>
        <p className="mt-2 font-mono text-xs text-muted">
          Started {formatAbsolute(incident.startedAt)}
          {incident.resolvedAt && (
            <> · Resolved {formatRelativeAgo(incident.resolvedAt)}</>
          )}
        </p>

        <form
          action={updateIncident}
          className="mt-8 space-y-5 rounded-2xl border border-border bg-surface/30 p-6"
        >
          <input type="hidden" name="id" value={incident.id} />

          <label className="block">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Title
            </span>
            <input
              type="text"
              name="title"
              defaultValue={incident.title}
              required
              maxLength={200}
              className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Severity
            </span>
            <select
              name="severity"
              defaultValue={incident.severity}
              className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Updates · most recent at top
            </span>
            <textarea
              name="body"
              rows={12}
              maxLength={10_000}
              defaultValue={incident.body}
              placeholder="Append updates as the situation evolves. e.g.:&#10;&#10;14:42 — Identified the root cause as a misconfigured cache TTL.&#10;14:25 — Affecting ~5% of patient portal users.&#10;14:10 — Investigating reports of slow response times."
              className="w-full resize-y rounded-lg bg-background px-3 py-3 text-sm leading-relaxed text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
            >
              <Save className="h-3.5 w-3.5" />
              Save update
            </button>

            {isOpen ? (
              <button
                type="submit"
                formAction={resolveIncident}
                className="inline-flex items-center gap-2 rounded-full bg-success/15 px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-success/25"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark resolved
              </button>
            ) : (
              <button
                type="submit"
                formAction={reopenIncident}
                className="inline-flex items-center gap-2 rounded-full border border-warning/30 px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/10"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reopen
              </button>
            )}

            <button
              type="submit"
              formAction={deleteIncident}
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-signal/30 px-3 py-2 text-xs font-medium text-signal transition-colors hover:bg-signal/10"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>

          <p className="text-xs text-muted">
            Saving an update revalidates{" "}
            <Link
              href="/status"
              className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              /status
            </Link>{" "}
            so customers see the new text within a few seconds.
          </p>
        </form>
      </div>
    </Section>
  );
}

void AlertCircle; // re-import shim — keeps the icon available if we add a banner later
