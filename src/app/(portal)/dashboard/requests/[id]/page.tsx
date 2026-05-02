import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ThumbsUp, MessageCircle, Archive, ArchiveRestore } from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  StatusPill,
  PriorityPill,
  TypeLabel,
} from "@/components/status-pill";
import { MessageThread } from "@/components/message-thread";
import {
  getRequestForCurrentUser,
  approveRequest,
  archiveRequest,
  unarchiveRequest,
} from "@/server/requests";
import { listMessagesForRequest } from "@/server/messages";
import { auth } from "@/auth";
import { formatRelativeAgo } from "@/lib/time";

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
  const awaitingApproval = r.status === "in_review";
  const isArchived = Boolean(r.archivedAt);

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-3xl">
        <Link
          href="/requests"
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
            Submitted {formatRelativeAgo(created)}
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

        {/* Site URL surface — separate from description (Phase 3 v2) */}
        {r.url && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Site
            </span>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer external"
              className="font-mono text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              {r.url}
            </a>
            <ExternalLink className="h-3 w-3 text-muted" />
          </div>
        )}

        {isArchived && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface/40 px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <Archive className="h-4 w-4" />
              This request is archived. It&apos;s hidden from the default list.
            </p>
            <form action={unarchiveRequest}>
              <input type="hidden" name="requestId" value={r.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                Restore
              </button>
            </form>
          </div>
        )}

        <article className="mt-8 whitespace-pre-wrap rounded-xl border border-border bg-surface/40 p-6 text-base leading-relaxed text-foreground">
          {r.description}
        </article>

        {/* Approve / Request changes — only when awaiting client review */}
        {awaitingApproval && (
          <div className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft/30 p-6">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-background"
              >
                <ThumbsUp className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                  Awaiting your approval
                </p>
                <h3 className="mt-1 text-base font-semibold tracking-tight">
                  Does this look right?
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Your doctor thinks the work is done. Approve to mark it
                  resolved, or send a reply below if something&apos;s still off.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <form action={approveRequest}>
                <input type="hidden" name="requestId" value={r.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Approve · Mark resolved
                </button>
              </form>
              <a
                href="#composer"
                className="inline-flex items-center gap-2 rounded-full border border-border-strong px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <MessageCircle className="h-4 w-4" />
                Reply with changes
              </a>
            </div>
          </div>
        )}

        <h2
          id="composer"
          className="mt-12 mb-4 font-mono text-xs uppercase tracking-[0.18em] text-accent scroll-mt-20"
        >
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

        {!isArchived && (
          <div className="mt-12 flex justify-end border-t border-border pt-6">
            <form action={archiveRequest}>
              <input type="hidden" name="requestId" value={r.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
              >
                <Archive className="h-3 w-3" />
                Archive this request
              </button>
            </form>
          </div>
        )}
      </div>
    </Section>
  );
}
