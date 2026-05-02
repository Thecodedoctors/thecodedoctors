import type { Metadata } from "next";
import Link from "next/link";
import { Archive } from "lucide-react";
import { Section } from "@/components/ui/section";
import { listAllRequestsForStaff } from "@/server/requests";
import { StatusPill, PriorityPill, TypeLabel } from "@/components/status-pill";
import { RequestsFilterBar } from "@/components/requests/filter-bar";
import { db, requests } from "@/db";
import { isNotNull, sql } from "drizzle-orm";

export const metadata: Metadata = {
  title: "All requests · Practice",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  q?: string;
  archived?: string;
}>;

async function archivedCountForStaff(): Promise<number> {
  const rows = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(requests)
    .where(isNotNull(requests.archivedAt));
  return rows[0]?.n ?? 0;
}

export default async function AdminRequestsListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const includeArchived = params.archived === "1";

  const [rows, archivedCount] = await Promise.all([
    listAllRequestsForStaff({ q, includeArchived }),
    archivedCountForStaff(),
  ]);

  const headline = (() => {
    if (q) return `Search · "${q}"`;
    if (rows.length === 0) return "Practice is empty.";
    if (rows.length === 1) return "1 request";
    return `${rows.length} requests`;
  })();

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          All requests
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {headline}
        </h1>
      </div>

      <RequestsFilterBar
        q={q}
        includeArchived={includeArchived}
        archivedCount={archivedCount}
        basePath="/requests"
        accent="signal"
        totalShowing={rows.length}
      />

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            {q ? "No matches" : "Empty"}
          </p>
          <p className="mt-3 text-base text-foreground">
            {q
              ? "Nothing matches that search. Try a different phrase or include archived."
              : "When patients submit requests they'll surface here."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {rows.map((r) => {
            const isArchived = Boolean(r.archivedAt);
            return (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="block px-6 py-5 transition-colors hover:bg-surface/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                        {r.clientName}
                      </p>
                      <div className="mt-1 flex items-baseline gap-2">
                        {isArchived && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted ring-1 ring-inset ring-border"
                            aria-label="Archived"
                          >
                            <Archive className="h-2.5 w-2.5" />
                            Archived
                          </span>
                        )}
                        <h3
                          className={`text-base font-medium ${isArchived ? "text-muted" : "text-foreground"}`}
                        >
                          {r.title}
                        </h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <TypeLabel type={r.type} />
                        <span className="text-muted">·</span>
                        <PriorityPill priority={r.priority} />
                        <span className="text-muted">·</span>
                        <span className="font-mono text-xs text-muted">
                          Updated{" "}
                          {new Date(r.updatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {r.assignedDoctorName && (
                          <>
                            <span className="text-muted">·</span>
                            <span className="text-xs text-muted">
                              Assigned{" "}
                              <span className="text-foreground">
                                {r.assignedDoctorName}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
