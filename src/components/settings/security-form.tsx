"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/server/settings";

export function SecurityForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState(changePassword, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {!hasPassword && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-medium text-foreground">No password set yet</p>
          <p className="mt-1 text-xs text-muted">
            Your account doesn&apos;t have a password yet. Leave the current
            password blank and choose a new one to lock it in.
          </p>
        </div>
      )}

      {hasPassword && (
        <div>
          <label
            htmlFor="current-password"
            className="block text-sm font-medium text-foreground"
          >
            Current password
          </label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="mt-3 w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground outline-none ring-1 ring-inset ring-border placeholder:text-muted focus:ring-accent"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="new-password"
          className="block text-sm font-medium text-foreground"
        >
          New password
        </label>
        <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-3 w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground outline-none ring-1 ring-inset ring-border placeholder:text-muted focus:ring-accent"
        />
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="block text-sm font-medium text-foreground"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-3 w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground outline-none ring-1 ring-inset ring-border placeholder:text-muted focus:ring-accent"
        />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state?.ok && (
          <span className="inline-flex items-center gap-1.5 text-xs text-accent">
            <Check className="h-3.5 w-3.5" /> Password updated
          </span>
        )}
        {state && !state.ok && (
          <span className="text-xs text-signal">{state.error}</span>
        )}
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Updating…" : "Update password"}
    </Button>
  );
}
