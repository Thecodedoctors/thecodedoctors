import { AlertTriangle } from "lucide-react";

/**
 * Bright banner shown on every legal page until a real attorney has
 * reviewed and signed off on these documents. Remove this component
 * (and its imports) once counsel has cleared the policies.
 *
 * Why: AI-drafted legal text is a starting point, not a finish line.
 * The limitation-of-liability cap, the indemnification clause, and the
 * Checkup money-back terms in particular need professional review
 * before relying on them in a dispute.
 */
export function LegalReviewBanner() {
  return (
    <aside className="mt-8 rounded-2xl border border-warning/40 bg-warning/5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/15 text-warning ring-1 ring-inset ring-warning/30">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-warning">
            Pre-launch draft
          </p>
          <p className="mt-1 text-sm text-foreground">
            These policies are working drafts and are pending review by
            counsel. They reflect our current intent but should not be relied
            on as professional legal advice. Material clauses (liability,
            indemnification, refunds, dispute resolution) will be finalized
            before public launch.
          </p>
        </div>
      </div>
    </aside>
  );
}
