import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Section } from "@/components/ui/section";
import { createIncident } from "@/server/incidents";

export const metadata: Metadata = {
  title: "New incident · Practice",
  robots: { index: false, follow: false },
};

export default function NewIncidentPage() {
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

        <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Incident
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          New incident
        </h1>
        <p className="mt-2 text-sm text-muted">
          Goes live on{" "}
          <Link
            href="/status"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            /status
          </Link>{" "}
          immediately. Title and body are visible to anyone, so write the way
          you&apos;d want a customer to read it.
        </p>

        <form
          action={createIncident}
          className="mt-8 space-y-5 rounded-2xl border border-border bg-surface/30 p-6"
        >
          <label className="block">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Title
            </span>
            <input
              type="text"
              name="title"
              required
              maxLength={200}
              placeholder="e.g. Patient portal slow for some users"
              className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Severity
            </span>
            <select
              name="severity"
              defaultValue="minor"
              className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            >
              <option value="minor">Minor — degraded for some</option>
              <option value="major">Major — partial outage</option>
              <option value="critical">Critical — full outage</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              First update
            </span>
            <textarea
              name="body"
              rows={8}
              maxLength={10_000}
              placeholder="What you know so far — symptoms, scope, what we're doing about it. Be honest; it's better than silence."
              className="w-full resize-y rounded-lg bg-background px-3 py-3 text-sm leading-relaxed text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            />
          </label>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-signal/90"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Open incident
          </button>
        </form>
      </div>
    </Section>
  );
}
