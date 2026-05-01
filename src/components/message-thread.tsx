"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Send, Lock, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatRelativeAgo } from "@/lib/time";
import { addMessage } from "@/server/messages";
import { isStaff } from "@/lib/auth-helpers";

export type ThreadMessage = {
  id: string;
  body: string;
  internal: boolean;
  createdAt: Date;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorRole: string | null;
};

export function MessageThread({
  requestId,
  messages,
  viewer,
}: {
  requestId: string;
  messages: ThreadMessage[];
  viewer: {
    id: string;
    role: string | undefined;
    name: string | null | undefined;
  };
}) {
  const viewerIsStaff = isStaff(viewer.role);

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {messages.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
            No messages yet. Start the conversation below.
          </li>
        ) : (
          messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              isOwn={m.authorId === viewer.id}
              viewerIsStaff={viewerIsStaff}
            />
          ))
        )}
      </ul>

      <Composer requestId={requestId} viewerIsStaff={viewerIsStaff} />
    </div>
  );
}

function MessageRow({
  message,
  isOwn,
  viewerIsStaff,
}: {
  message: ThreadMessage;
  isOwn: boolean;
  viewerIsStaff: boolean;
}) {
  const authorIsStaff = isStaff(message.authorRole ?? undefined);
  const displayName =
    message.authorName ?? message.authorEmail?.split("@")[0] ?? "Someone";
  const time = new Date(message.createdAt);

  return (
    <li
      className={cn(
        "rounded-xl border p-5",
        message.internal
          ? "border-warning/30 bg-warning/5"
          : authorIsStaff
            ? "border-accent/20 bg-accent-soft/40"
            : "border-border bg-surface/40"
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.14em]",
            authorIsStaff ? "text-accent" : "text-muted-strong"
          )}
        >
          {authorIsStaff && <Stethoscope className="h-3 w-3" />}
          {displayName}
        </span>
        <span className="text-muted">·</span>
        <time dateTime={time.toISOString()} className="font-mono text-muted">
          {formatRelativeAgo(time)}
        </time>
        {message.internal && (
          <>
            <span className="text-muted">·</span>
            <span className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.14em] text-warning">
              <Lock className="h-3 w-3" />
              Internal
            </span>
          </>
        )}
        {isOwn && (
          <>
            <span className="text-muted">·</span>
            <span className="font-mono text-muted">You</span>
          </>
        )}
        {viewerIsStaff && message.internal && !authorIsStaff && (
          <span className="text-muted">(visible to client)</span>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {message.body}
      </p>
    </li>
  );
}

function Composer({
  requestId,
  viewerIsStaff,
}: {
  requestId: string;
  viewerIsStaff: boolean;
}) {
  const [state, action] = useActionState(addMessage, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the textarea on successful send.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-xl border border-border-strong bg-surface/40 p-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="body"
        required
        rows={3}
        placeholder={
          viewerIsStaff
            ? "Reply to the patient — or check 'Internal' for a note your team only sees."
            : "Reply to your doctor…"
        }
        className="w-full resize-y rounded-lg bg-background px-4 py-3 text-base text-foreground outline-none ring-1 ring-inset ring-border placeholder:text-muted focus:ring-accent"
        maxLength={5000}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
        {viewerIsStaff ? (
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="internal"
              className="h-4 w-4 rounded border-border-strong bg-background accent-accent"
            />
            Internal note (hidden from client)
          </label>
        ) : (
          <span className="text-xs text-muted">
            Press send when ready.
          </span>
        )}
        <SendButton />
      </div>
      {state && !state.ok && (
        <p className="px-2 pb-2 text-xs text-signal">{state.error}</p>
      )}
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Sending…" : "Send"}
      {!pending && <Send className="h-3.5 w-3.5" />}
    </Button>
  );
}

