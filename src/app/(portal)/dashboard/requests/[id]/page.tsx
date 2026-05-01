import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  StatusPill,
  PriorityPill,
  TypeLabel,
} from "@/components/status-pill";
import { MessageThread } from "@/components/message-thread";
import {
  getRequestForCurrentUser,
} from "@/server/requests";
import { listMessagesForRequest } from "@/server/messages";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Request",
  robots: { index: false, follow: false },
};

export default async function RequestDetailPage({
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

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard/requests"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All requests
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            {r.title}
          </h1>
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
          {data.assignedDoctorName && (
            <>
              <span className="text-muted">·</span>
              <span className="text-xs text-muted-strong">
                Assigned to{" "}
                <span className="text-foreground">
                  {data.assignedDoctorName}
                </span>
              </span>
            </>
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
