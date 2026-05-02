import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Users as UsersIcon,
  Stethoscope,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { auth } from "@/auth";
import {
  getClientForStaff,
  updateClient,
  listStaffForPicker,
} from "@/server/clients";
import { checkOneClientNow } from "@/server/health";
import { StatusPill, PriorityPill, TypeLabel } from "@/components/status-pill";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Patient · Practice",
  robots: { index: false, follow: false },
};

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, session, staff] = await Promise.all([
    getClientForStaff(id),
    auth(),
    listStaffForPicker(),
  ]);
  if (!data || !session?.user) notFound();

  const isFounder = session.user.role === "founder";
  const c = data.client;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-4xl">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All patients
        </Link>

        {/* Header */}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                {c.name}
              </h1>
              <StatusBadge status={c.status} />
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
                {planLabel(c.plan)}
              </span>
            </div>
            {c.websiteUrl && (
              <a
                href={c.websiteUrl}
                target="_blank"
                rel="noopener noreferrer external"
                className="mt-2 inline-flex items-center gap-1.5 font-mono text-sm text-muted underline decoration-border-strong underline-offset-4 hover:decoration-signal"
              >
                {c.websiteUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <p className="mt-3 font-mono text-xs text-muted">
              Joined{" "}
              {new Date(c.createdAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {data.leadDoctor?.name && (
                <> · Lead doctor: <span className="text-foreground">{data.leadDoctor.name}</span></>
              )}
            </p>
          </div>
          {isFounder && c.mrrCents > 0 && (
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
                ${(c.mrrCents / 100).toFixed(0)}
                <span className="text-sm text-muted">/mo</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                MRR
              </p>
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div className="mt-8 grid gap-3 grid-cols-2 sm:grid-cols-4 rounded-2xl border border-border bg-surface/30 p-4">
          <Stat label="Open requests" value={data.openRequests} />
          <Stat label="Total requests" value={data.totalRequests} />
          <Stat label="Members" value={data.members.length} />
          <Stat
            label="Last activity"
            value={
              data.recentRequests[0]?.updatedAt
                ? formatRelativeAgo(data.recentRequests[0].updatedAt)
                : "—"
            }
          />
        </div>

        {/* Site health */}
        {c.websiteUrl && (
          <SiteHealthCard
            clientId={c.id}
            url={c.websiteUrl}
            latest={data.latestCheck}
          />
        )}

        {/* Recent requests */}
        <section className="mt-12">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Recent requests
            </h2>
            <span className="text-xs text-muted">
              {data.recentRequests.length} of {data.totalRequests}
            </span>
          </div>
          {data.recentRequests.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
              No requests submitted yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
              {data.recentRequests.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/requests/${r.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-surface/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-medium text-foreground">
                          {r.title}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                          <TypeLabel type={r.type} />
                          <span className="text-muted">·</span>
                          <PriorityPill priority={r.priority} />
                          <span className="text-muted">·</span>
                          <span className="font-mono text-xs text-muted">
                            Updated {formatRelativeAgo(r.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Members */}
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Members
          </h2>
          {data.members.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
              No team members linked yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
              {data.members.map((m) => (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {m.name ?? m.email ?? "(unnamed)"}
                    </p>
                    {m.name && m.email && (
                      <p className="font-mono text-xs text-muted">
                        {m.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    {m.isAdmin && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                        Admin
                      </span>
                    )}
                    <span className="font-mono">
                      Joined{" "}
                      {new Date(m.joinedAt).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Edit form */}
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            {isFounder ? "Edit account" : "Edit details"}
          </h2>
          <form
            action={updateClient}
            className="space-y-5 rounded-2xl border border-border bg-surface/30 p-6"
          >
            <input type="hidden" name="clientId" value={c.id} />

            <Field label="Name">
              <input
                type="text"
                name="name"
                defaultValue={c.name}
                className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
              />
            </Field>

            <Field label="Website URL">
              <input
                type="text"
                name="websiteUrl"
                defaultValue={c.websiteUrl ?? ""}
                placeholder="example.com"
                className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
              />
            </Field>

            {isFounder && (
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Plan">
                  <select
                    name="plan"
                    defaultValue={c.plan}
                    className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
                  >
                    <option value="checkup">Free Checkup</option>
                    <option value="general">General Care</option>
                    <option value="premium">Premium Care</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    name="status"
                    defaultValue={c.status}
                    className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
                  >
                    <option value="active">Active</option>
                    <option value="lead">Lead</option>
                    <option value="discharged">Discharged</option>
                  </select>
                </Field>
                <Field label="MRR (USD/mo)">
                  <input
                    type="number"
                    name="mrrDollars"
                    step="50"
                    min="0"
                    defaultValue={(c.mrrCents / 100).toFixed(0)}
                    className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
                  />
                </Field>
              </div>
            )}

            <Field label="Lead doctor">
              <select
                name="leadDoctorId"
                defaultValue={c.leadDoctorId ?? "__none__"}
                className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
              >
                <option value="__none__">— Unassigned —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.email}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Notes"
              hint="Internal — patients never see this."
            >
              <textarea
                name="notes"
                defaultValue={c.notes ?? ""}
                rows={4}
                maxLength={2000}
                className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
              />
            </Field>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
              >
                Save changes
              </button>
              <p className="text-xs text-muted">
                Changes are recorded in the audit log.
              </p>
            </div>
          </form>
        </section>
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function SiteHealthCard({
  clientId,
  url,
  latest,
}: {
  clientId: string;
  url: string;
  latest:
    | {
        ok: boolean;
        responseTimeMs: number | null;
        error: string | null;
        checkedAt: Date;
      }
    | null;
}) {
  return (
    <section
      className={cn(
        "mt-8 rounded-2xl border p-6",
        latest && !latest.ok
          ? "border-signal/40 bg-signal/5"
          : "border-border bg-surface/40"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Site health
          </p>
          <h3 className="mt-2 inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            {!latest ? (
              <>
                <Clock className="h-4 w-4 text-muted" />
                Awaiting first check
              </>
            ) : latest.ok ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                Up
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-signal" />
                Down
              </>
            )}
          </h3>
          {latest && (
            <p className="mt-1 text-sm text-muted">
              {latest.ok
                ? `${latest.responseTimeMs ? `${latest.responseTimeMs}ms` : "Healthy"} · checked ${formatRelativeAgo(latest.checkedAt)}`
                : `${latest.error ?? "Unreachable"} · since ${formatRelativeAgo(latest.checkedAt)}`}
            </p>
          )}
          <p className="mt-2 font-mono text-xs text-muted">{url}</p>
        </div>
        <form action={checkOneClientNow}>
          <input type="hidden" name="clientId" value={clientId} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-signal hover:text-signal"
          >
            <RefreshCw className="h-3 w-3" />
            Check now
          </button>
        </form>
      </div>
    </section>
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
      icon: UsersIcon,
      cls: "bg-warning/10 text-warning ring-warning/30",
    },
  }[status] ?? {
    icon: Stethoscope,
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

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="px-2 py-1">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {children}
    </label>
  );
}

function planLabel(plan: string): string {
  if (plan === "checkup") return "Free Checkup";
  if (plan === "general") return "General Care";
  if (plan === "premium") return "Premium Care";
  return plan;
}
