import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Users, Activity, Shield } from "lucide-react";
import { auth } from "@/auth";
import { Section } from "@/components/ui/section";
import { listAllRequestsForStaff, staffStats } from "@/server/requests";
import {
  StatusPill,
  PriorityPill,
  TypeLabel,
} from "@/components/status-pill";

export const metadata: Metadata = {
  title: "Practice",
  description: "Code Doctors practice dashboard.",
  robots: { index: false, follow: false },
};

export default async function AdminHomePage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "Doctor";
  const [requests, stats] = await Promise.all([
    listAllRequestsForStaff(),
    staffStats(),
  ]);

  const open = requests.filter(
    (r) => r.status !== "healed" && r.status !== "closed"
  );

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Practice
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Good morning, {firstName}.
        </h1>
        <p className="mt-3 text-base text-muted">
          {open.length === 0
            ? "Inbox is empty. Either we're caught up, or no one's submitted today."
            : `${open.length} open request${open.length === 1 ? "" : "s"} ${
                stats.urgentRequests > 0
                  ? `· ${stats.urgentRequests} urgent`
                  : ""
              }`}
        </p>
      </div>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open requests" value={stats.openRequests} icon={Inbox} />
        <StatCard label="Urgent" value={stats.urgentRequests} icon={Shield} accent="signal" />
        <StatCard label="Active patients" value={stats.activeClients} icon={Users} />
        <StatCard label="Total in queue" value={requests.length} icon={Activity} />
      </ul>

      <div className="mt-12">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Inbox
        </h2>
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
            <p className="text-muted">
              No requests yet. When patients submit, they show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="block px-6 py-5 transition-colors hover:bg-surface/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                        {r.clientName}
                        {r.assignedDoctorName && (
                          <> · {r.assignedDoctorName}</>
                        )}
                      </p>
                      <h3 className="mt-1 text-base font-medium text-foreground">
                        {r.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <TypeLabel type={r.type} />
                        <span className="text-muted">·</span>
                        <PriorityPill priority={r.priority} />
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "signal";
}) {
  return (
    <li className="card-hover flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-6">
      <span
        className={
          accent === "signal"
            ? "grid h-9 w-9 place-items-center rounded-lg bg-signal/10 text-signal ring-1 ring-inset ring-signal/30"
            : "grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20"
        }
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
    </li>
  );
}
