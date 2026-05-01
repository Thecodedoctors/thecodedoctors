import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import {
  StatusPill,
  PriorityPill,
  TypeLabel,
} from "@/components/status-pill";
import { MessageThread } from "@/components/message-thread";
import { auth } from "@/auth";
import {
  getRequestForCurrentUser,
  updateRequestStatus,
  assignRequestToSelf,
} from "@/server/requests";
import { listMessagesForRequest } from "@/server/messages";

export const metadata: Metadata = {
  title: "Request · Admin",
  robots: { index: false, follow: false },
};

const STATUSES = [
  { value: "triaged", label: "Triaged" },
  { value: "diagnosed", label: "Diagnosed" },
  { value: "in_treatment", label: "In Treatment" },
  { value: "in_review", label: "In Review" },
  { value: "healed", label: "Healed" },
  { value: "closed", label: "Closed" },
];

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, messages, session] = await Promise.all([
    getRequestForCurrentUser(id),
    listMessagesForRequest(id),
    auth(),
  ]);

  if (!data || !session?.user) notFound();

  const r = data.request;
  const created = new Date(r.createdAt);
  const isAssignedToMe = r.assignedDoctorId === session.user.id;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Inbox
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
              {data.clientName}
            </p>
            <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              {r.title}
            </h1>
          </div>
          <StatusPill status={r.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <TypeLabel type={r.type} />
          <span className="text-muted">·</span>
          <PriorityPill priority={r.priority} />
          <span className="text-muted">·</span>
          <span className="font-mono text-xs text-muted">
            Submitted{" "}
            {created.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Staff controls */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft/30 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            Staff
          </p>

          <form action={updateRequestStatus} className="flex items-center gap-2">
            <input type="hidden" name="requestId" value={r.id} />
            <label className="inline-flex items-center gap-2 text-xs text-muted">
              Status
              <select
                name="status"
                defaultValue={r.status}
                className="rounded-md bg-background px-2 py-1.5 text-xs text-foreground ring-1 ring-inset ring-border focus:ring-accent"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#e6e9ee]"
            >
              Update
            </button>
          </form>

          <form action={assignRequestToSelf}>
            <input type="hidden" name="requestId" value={r.id} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={isAssignedToMe}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {isAssignedToMe
                ? "Assigned to you"
                : data.assignedDoctorName
                  ? "Reassign to me"
                  : "Assign to me"}
            </Button>
          </form>

          {data.assignedDoctorName && !isAssignedToMe && (
            <p className="text-xs text-muted">
              Currently with{" "}
              <span className="text-foreground">
                {data.assignedDoctorName}
              </span>
            </p>
          )}
        </div>

        <article className="mt-8 whitespace-pre-wrap rounded-xl border border-border bg-surface/40 p-6 text-base leading-relaxed text-foreground">
          {r.description}
        </article>

        <h2 className="mt-12 mb-4 font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Conversation
        </h2>

        <MessageThread
          requestId={r.id}
          messages={messages.map((m) => ({
            ...m,
            createdAt: new Date(m.createdAt),
          }))}
          viewer={{
            id: session.user.id,
            role: session.user.role,
            name: session.user.name,
          }}
        />
      </div>
    </Section>
  );
}
