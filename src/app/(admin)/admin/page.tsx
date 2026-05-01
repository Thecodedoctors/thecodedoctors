import type { Metadata } from "next";
import { auth } from "@/auth";
import { Section } from "@/components/ui/section";
import { Inbox, Users, Activity, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Practice",
  description: "Code Doctors practice dashboard.",
  robots: { index: false, follow: false },
};

export default async function AdminHomePage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "Doctor";

  // Phase 5 wires real numbers. For v1 we render the layout / structure.
  const stats = [
    { label: "Open requests", value: "—", icon: Inbox },
    { label: "Active patients", value: "—", icon: Users },
    { label: "Site fleet healthy", value: "—", icon: Activity },
    { label: "Security alerts", value: "—", icon: Shield },
  ];

  return (
    <Section size="md" reveal={false}>
      <div className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Practice
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Good morning, {firstName}.
        </h1>
        <p className="mt-4 text-lg text-muted">
          The state of the practice today. Click any panel below to drill in.
        </p>
      </div>

      <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <li
            key={s.label}
            className="card-hover flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-6"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
              <s.icon className="h-4 w-4" />
            </span>
            <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
              {s.value}
            </p>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">{s.label}</p>
          </li>
        ))}
      </ul>

      <div className="mt-12 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Phase 5 placeholder
        </p>
        <p className="mt-3 max-w-2xl mx-auto text-muted">
          Universal inbox, drag-to-assign workflow, client CRM, time tracking,
          and the audit log all build out from this layout. The schema and
          auth-gated structure are in place — next session we wire the live
          data.
        </p>
      </div>
    </Section>
  );
}
