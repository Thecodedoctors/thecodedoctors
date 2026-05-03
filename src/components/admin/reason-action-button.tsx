"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, X, type LucideIcon } from "lucide-react";

type ServerAction = (formData: FormData) => Promise<
  | { ok: true; message: string }
  | { ok: false; error: string }
>;

/**
 * Founder-only destructive action button. Opens a small modal that
 * forces the actor to type a reason (10–500 chars) before submitting.
 * The wrapped server action is responsible for auditing + emailing
 * the affected user; this component just owns the prompt + result
 * banner.
 *
 * Use this anywhere you want a "are you sure?" with a written
 * justification — suspend, delete, pause, discharge, etc.
 */
export function ReasonActionButton({
  /** The server action to call. Must accept a FormData and return
   *  { ok: true, message } | { ok: false, error }. */
  action,
  /** Hidden form fields included on submit — typically `userId` or
   *  `clientId`. */
  hiddenFields,
  /** What the trigger button looks like in the parent surface. */
  trigger,
  /** Modal copy. */
  title,
  description,
  confirmLabel,
  /** Visual tone — "danger" colours the button + modal in signal red,
   *  "muted" keeps it neutral (e.g. for restore actions which still
   *  email the user but aren't destructive). */
  tone = "danger",
  reasonPlaceholder,
}: {
  action: ServerAction;
  hiddenFields: Record<string, string>;
  trigger: { label: string; icon?: LucideIcon };
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "muted";
  reasonPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open + handle Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pending]);

  function close() {
    if (pending) return;
    setOpen(false);
    setReason("");
    setError(null);
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(hiddenFields)) fd.set(k, v);
    fd.set("reason", reason);
    startTransition(async () => {
      try {
        const res = await action(fd);
        if (res.ok) {
          setSuccess(res.message);
          setOpen(false);
          setReason("");
          // Auto-clear the success banner after a few seconds.
          setTimeout(() => setSuccess(null), 6000);
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Something went wrong on our end."
        );
      }
    });
  }

  const tooShort = reason.trim().length < 10;
  const tooLong = reason.trim().length > 500;
  const TriggerIcon = trigger.icon;

  const triggerCls =
    tone === "danger"
      ? "border-signal/30 text-signal hover:bg-signal/10"
      : "border-border-strong text-muted hover:border-accent hover:text-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors ${triggerCls}`}
      >
        {TriggerIcon && <TriggerIcon className="h-3 w-3" />}
        {trigger.label}
      </button>

      {success && (
        <p
          role="status"
          className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-success ring-1 ring-inset ring-success/30"
        >
          {success}
        </p>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reason-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          {/* Backdrop */}
          <div
            aria-hidden
            onClick={close}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          {/* Panel */}
          <div
            ref={dialogRef}
            className={`relative w-full max-w-lg overflow-hidden rounded-2xl border bg-surface-2 shadow-2xl shadow-black/40 ${
              tone === "danger" ? "border-signal/40" : "border-border-strong"
            }`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/60 px-6 py-4">
              <div>
                <p
                  className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
                    tone === "danger" ? "text-signal" : "text-muted"
                  }`}
                >
                  {tone === "danger" ? "Confirm" : "Action"}
                </p>
                <h2
                  id="reason-dialog-title"
                  className="mt-1 text-lg font-semibold tracking-tight"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-foreground">{description}</p>

              <label className="mt-5 block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                  Reason · 10–500 characters · sent to the user
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                  disabled={pending}
                  placeholder={
                    reasonPlaceholder ??
                    "Explain in one or two sentences why this action is being taken."
                  }
                  className={`w-full resize-y rounded-xl bg-background px-4 py-3 text-sm text-foreground outline-none ring-1 ring-inset placeholder:text-muted ${
                    tone === "danger"
                      ? "ring-border focus:ring-signal/60"
                      : "ring-border focus:ring-accent/60"
                  }`}
                />
                <span className="mt-1 block text-right font-mono text-[10px] text-muted">
                  {reason.trim().length} / 500
                </span>
              </label>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                  <p className="text-xs text-foreground">{error}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-background/40 px-6 py-4">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-full border border-border-strong px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || tooShort || tooLong}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                  tone === "danger"
                    ? "bg-signal text-background hover:bg-signal/90"
                    : "bg-foreground text-background hover:bg-[#e6e9ee]"
                }`}
              >
                {pending ? "Working…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
