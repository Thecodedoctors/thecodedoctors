import type { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  Archive,
  Users,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  listAllClientsForStaff,
  clientCountsByStatus,
  type ClientListRow,
} from "@/server/clients";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Patients · Practice",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  q?: string;
  status?: "active" | "lead" | "discharged" | "all";
  sort?: "name" | "mrr" | "recent";
}>;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = params.status ?? "active";
  const sort = params.sort ?? "name";

  // TEMP: capture and surface raw errors so we can debug the production 500.
  // Once we know the cause we'll restore the unconditional Promise.all().
  let session: Session | null;
  let rows: ClientListRow[];
  let counts: Awaited<ReturnType<typeof clientCountsByStatus>>;
  try {
    [session, rows, counts] = await Promise.all([
      auth() as Promise<Session | null>,
      listAllClientsForStaff({ q, status, sort }),
      clientCountsByStatus(),
    ]);
  } catch (err) {
    return <DebugError err={err} stage="data fetch" />;
  }

  const isFounder = session?.user?.role === "founder";

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Patients
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {q
            ? `Search · "${q}"`
            : rows.length === 0
              ? "No patients in this view"
              : `${rows.length} patient${rows.length === 1 ? "" : "s"}`}
        </h1>
      </div>

      <div className="mt-6 space-y-3">
        {/* Search */}
        <form
          action="/clients"
          method="get"
          className="flex items-center gap-2 rounded-xl bg-background px-4 py-2.5 ring-1 ring-inset ring-border focus-within:ring-signal"
        >
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by patient name…"
            aria-label="Search patients"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="sort" value={sort} />
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#e6e9ee]"
          >
            Search
          </button>
        </form>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            label="Active"
            count={counts.active}
            active={status === "active"}
            href={pathFor({ status: "active", q, sort })}
          />
          <FilterPill
            label="Leads"
            count={counts.lead}
            active={status === "lead"}
            href={pathFor({ status: "lead", q, sort })}
          />
          <FilterPill
            label="Discharged"
            count={counts.discharged}
            active={status === "discharged"}
            href={pathFor({ status: "discharged", q, sort })}
          />
          <FilterPill
            label="All"
            count={counts.total}
            active={status === "all"}
            href={pathFor({ status: "all", q, sort })}
          />

          <span className="ml-auto text-xs text-muted">Sort by:</span>
          <SortPill
            label="Name"
            active={sort === "name"}
            href={pathFor({ status, q, sort: "name" })}
          />
          {isFounder && (
            <SortPill
              label="MRR"
              active={sort === "mrr"}
              href={pathFor({ status, q, sort: "mrr" })}
            />
          )}
          <SortPill
            label="Recent"
            active={sort === "recent"}
            href={pathFor({ status, q, sort: "recent" })}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface text-muted ring-1 ring-inset ring-border">
            <Users className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm text-foreground">
            {q ? "Nothing matches that search." : "No patients in this segment yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {rows.map((c) => (
            <PatientRow key={c.id} client={c} showMrr={isFounder} />
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function PatientRow({
  client,
  showMrr,
}: {
  client: Awaited<ReturnType<typeof listAllClientsForStaff>>[number];
  showMrr: boolean;
}) {
  return (
    <li>
      <Link
        href={`/clients/${client.id}`}
        className="block px-5 py-4 transition-colors hover:bg-surface/80"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-base font-medium text-foreground">
                {client.name}
              </h3>
              <StatusBadge status={client.status} />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                {planLabel(client.plan)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
              {client.primaryUserName && (
                <span>
                  <span className="text-foreground">{client.primaryUserName}</span>
                  {client.primaryUserEmail ? ` · ${client.primaryUserEmail}` : ""}
                </span>
              )}
              {client.websiteUrl && (
                <a
                  href={client.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer external"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 font-mono underline decoration-border-strong underline-offset-4 hover:decoration-signal"
                >
                  {safeHost(client.websiteUrl)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted">
              <span>
                <span className="text-foreground">{client.openRequests}</span>{" "}
                open · {client.totalRequests} total
              </span>
              {client.lastActivityAt && (
                <span>
                  Last activity {formatRelativeAgo(client.lastActivityAt)}
                </span>
              )}
              <span>
                Joined{" "}
                {new Date(client.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          {showMrr && client.mrrCents > 0 && (
            <div className="text-right">
              <p className="font-mono text-base font-semibold text-foreground">
                ${(client.mrrCents / 100).toFixed(0)}
                <span className="text-xs text-muted">/mo</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                MRR
              </p>
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: {
      icon: CheckCircle2,
      cls: "bg-success/10 text-success ring-success/30",
    },
    lead: {
      icon: Clock,
      cls: "bg-muted/10 text-muted ring-muted/20",
    },
    discharged: {
      icon: Archive,
      cls: "bg-warning/10 text-warning ring-warning/30",
    },
  }[status] ?? {
    icon: Clock,
    cls: "bg-muted/10 text-muted ring-muted/20",
  };
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
        config.cls
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {status}
    </span>
  );
}

function FilterPill({
  label,
  count,
  active,
  href,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors",
        active
          ? "bg-foreground text-background font-medium"
          : "border border-border-strong text-muted hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 font-mono text-[10px]",
          active ? "bg-background/20" : "bg-border text-muted"
        )}
      >
        {count}
      </span>
    </Link>
  );
}

function SortPill({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2 py-1 text-xs transition-colors",
        active
          ? "bg-surface text-foreground ring-1 ring-inset ring-border"
          : "text-muted hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

function pathFor(parts: { q?: string; status?: string; sort?: string }): string {
  const sp = new URLSearchParams();
  if (parts.q) sp.set("q", parts.q);
  if (parts.status && parts.status !== "active") sp.set("status", parts.status);
  if (parts.sort && parts.sort !== "name") sp.set("sort", parts.sort);
  const qs = sp.toString();
  return qs ? `/clients?${qs}` : "/clients";
}

function planLabel(plan: string): string {
  if (plan === "checkup") return "Free Checkup";
  if (plan === "general") return "General Care";
  if (plan === "premium") return "Premium Care";
  return plan;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** TEMP debug surface — print real error info inline, bypassing Next.js's
 *  production sanitization. Server-rendered JSX so message + stack pass
 *  straight through to the browser. Remove once we've fixed the 500. */
function DebugError({ err, stage }: { err: unknown; stage: string }) {
  const e = err as { name?: string; message?: string; stack?: string; cause?: unknown; digest?: string };
  return (
    <Section size="md" reveal={false}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
        Patients · debug
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Error during {stage}
      </h1>
      <pre className="mt-6 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-signal/30 bg-signal/5 p-5 font-mono text-xs text-foreground">
        <strong className="text-signal">{e.name ?? "Error"}:</strong>{" "}
        {e.message ?? String(err)}
        {e.digest && `\n\ndigest: ${e.digest}`}
        {e.cause ? `\n\ncause: ${JSON.stringify(e.cause, null, 2)}` : ""}
        {e.stack && `\n\n${e.stack}`}
      </pre>
    </Section>
  );
}
