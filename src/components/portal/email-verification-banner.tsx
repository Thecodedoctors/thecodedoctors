import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";

/**
 * Top-of-page banner shown to patients whose email isn't yet verified.
 * Renders nothing if `verifiedAt` is set. Server component — the
 * patient layout queries `emailVerified` and passes it in.
 *
 * Design: subtle warning tone — we never want to make a paying patient
 * feel scolded for not verifying. A nudge, not a wall.
 */
export function EmailVerificationBanner({
  verifiedAt,
}: {
  verifiedAt: Date | null;
}) {
  if (verifiedAt) return null;
  return (
    <div className="border-b border-warning/30 bg-warning/5">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-10">
        <div className="flex items-start gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-warning/15 text-warning ring-1 ring-inset ring-warning/30">
            <Mail className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm text-foreground">
              Quick housekeeping — verify your email so we can send your
              monthly report.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Takes 10 seconds. Check your inbox for a 6-digit code.
            </p>
          </div>
        </div>
        <Link
          href="/verify-email"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/15 px-3.5 py-1.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/30 transition-colors hover:bg-warning/25"
        >
          Verify
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
