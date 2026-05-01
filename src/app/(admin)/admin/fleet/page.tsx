import type { Metadata } from "next";
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { fleetForStaff, runChecksForAllClients, checkOneClientNow } from "@/server/health";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Fleet · Practice",
  robots: { index: false, follow: false },
};

export default async function FleetPage() {
  const fleet = await fleetForStaff();
  const down = fleet.filter((r) => r.latest && !r.latest.ok);
  const up = fleet.filter((r) => r.latest && r.latest.ok);
  const noData = fleet.filter((r) => !r.latest);

  return (
    <Section size="md" reveal={false} className="!py-12 md:!py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
            Fleet
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {fleet.length === 0
              ? "No sites configured yet"
              : down.length > 0
                ? `${down.length} site${down.length === 1 ? "" : "s"} down · ${up.length} up`
                : `All ${up.length} site${up.length === 1 ? "" : "s"} up`}
          </h1>
        </div>
        <form
          action={async () => {
            "use server";
            await runChecksForAllClients();
          }}
        >
          <Button type="submit" variant="primary" size="md">
            <RefreshCw className="h-4 w-4" />
            Run all checks now
          </Button>
        </form>
      </div>

      {fleet.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted/10 text-muted ring-1 ring-inset ring-muted/20">
            <Activity className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base text-foreground">
            No client has configured a site URL yet.
          </p>
          <p className="mt-2 text-sm text-muted">
            Patients add their URL on their dashboard. Once they do,
            their site shows up here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          {down.length > 0 && (
            <FleetGroup title="Down" tone="signal" rows={down} />
          )}
          {up.length > 0 && (
            <FleetGroup title="Healthy" tone="success" rows={up} />
          )}
          {noData.length > 0 && (
            <FleetGroup title="Not yet checked" tone="muted" rows={noData} />
          )}
        </div>
      )}
    </Section>
  );
}

type Row = {
  clientId: string;
  clientName: string;
  websiteUrl: string;
  latest: {
    url: string;
    ok: boolean;
    statusCode: number | null;
    responseTimeMs: number | null;
    error: string | null;
    checkedAt: Date;
  } | null;
};

function FleetGroup({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "signal" | "success" | "muted";
  rows: Row[];
}) {
  const ringClass = {
    signal: "bg-signal/10 text-signal ring-signal/30",
    success: "bg-success/10 text-success ring-success/30",
    muted: "bg-muted/10 text-muted ring-muted/20",
  }[tone];

  return (
    <div>
      <h2 className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            tone === "signal"
              ? "bg-signal"
              : tone === "success"
                ? "bg-success"
                : "bg-muted/50"
          )}
        />
        <span className="text-muted">{title}</span>
        <span className="text-muted">·</span>
        <span className="text-muted">{rows.length}</span>
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <li
            key={r.clientId}
            className="card-hover flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  {r.clientName}
                </p>
                <a
                  href={r.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer external"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
                >
                  <span className="truncate max-w-[200px]">{r.websiteUrl}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted" />
                </a>
              </div>
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                  ringClass
                )}
              >
                {r.latest?.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : r.latest ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
              </span>
            </div>

            {r.latest ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
                    Last check
                  </p>
                  <p className="mt-0.5 text-foreground">
                    {formatRelativeAgo(r.latest.checkedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
                    Status
                  </p>
                  <p className="mt-0.5 font-mono text-foreground">
                    {r.latest.statusCode ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
                    Response
                  </p>
                  <p className="mt-0.5 font-mono text-foreground">
                    {r.latest.responseTimeMs
                      ? `${r.latest.responseTimeMs}ms`
                      : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">
                No check on file yet.
              </p>
            )}

            {r.latest && !r.latest.ok && r.latest.error && (
              <p className="rounded-md border border-signal/30 bg-signal/5 px-2.5 py-1.5 text-xs text-foreground">
                {r.latest.error}
              </p>
            )}

            <form action={checkOneClientNow}>
              <input type="hidden" name="clientId" value={r.clientId} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                Check now
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
