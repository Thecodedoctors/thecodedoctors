"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateProfileName } from "@/server/settings";

export function ProfileForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string;
}) {
  const [state, action] = useActionState(updateProfileName, null);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-foreground">Email</label>
        <p className="mt-1 text-sm text-muted">
          {email}
          <span className="ml-2 text-xs text-muted/70">
            (used to sign in — not editable here)
          </span>
        </p>
      </div>

      <div>
        <label
          htmlFor="profile-name"
          className="block text-sm font-medium text-foreground"
        >
          Name
        </label>
        <p className="mt-1 text-xs text-muted">
          Shown to your doctors on every reply.
        </p>
        <input
          id="profile-name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={defaultName}
          placeholder="Your name"
          className="mt-3 w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground outline-none ring-1 ring-inset ring-border placeholder:text-muted focus:ring-accent"
        />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state?.ok && (
          <span className="inline-flex items-center gap-1.5 text-xs text-accent">
            <Check className="h-3.5 w-3.5" /> Saved
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
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}
