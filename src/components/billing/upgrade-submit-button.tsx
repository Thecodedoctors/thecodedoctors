"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Submit button for the billing upgrade / switch-to-yearly forms.
 *
 * `upgradeSubscriptionForCurrentUser` calls Stripe with
 * `proration_behavior: "always_invoice"` — it charges the card
 * immediately, then redirects back with a ?upgrade= banner. That call
 * takes a few seconds; without a pending state the button gave no
 * feedback and a second click could re-fire the charge. This disables
 * the button while the action is in flight and shows progress.
 *
 * Rendered INSIDE the server-component <form> so useFormStatus reports
 * that form's submission state.
 */
export function UpgradeSubmitButton({
  className,
  pendingLabel = "Switching…",
  children,
}: {
  className?: string;
  pendingLabel?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        className,
        pending && "pointer-events-none opacity-60"
      )}
    >
      {children}
      {pending && (
        <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          {pendingLabel} don&apos;t close this tab
        </span>
      )}
    </button>
  );
}
