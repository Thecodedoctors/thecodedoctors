"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, User, Mail, Lock, Globe, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startTrial, startWithPlan, type OnboardResult } from "@/server/onboard";

type Variant = "trial" | "plan";

export function OnboardForm({
  variant,
  plan,
  defaultEmail,
  defaultUrl,
  refCode,
}: {
  variant: Variant;
  /** Required when variant === "plan". Ignored for trial (always General). */
  plan?: "general" | "premium";
  defaultEmail?: string;
  defaultUrl?: string;
  refCode?: string;
}) {
  const action = variant === "trial" ? startTrial : startWithPlan;
  const [state, formAction] = useActionState<OnboardResult | null, FormData>(
    action,
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      {variant === "plan" && plan && (
        <input type="hidden" name="plan" value={plan} />
      )}
      {refCode && (
        <input type="hidden" name="ref" value={refCode} />
      )}

      <Field icon={User}>
        <input
          type="text"
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Your name"
          autoComplete="name"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </Field>

      <Field icon={Building}>
        <input
          type="text"
          name="businessName"
          required
          minLength={2}
          maxLength={200}
          placeholder="Business name"
          autoComplete="organization"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </Field>

      <Field icon={Globe}>
        <input
          type="url"
          name="websiteUrl"
          required
          inputMode="url"
          autoComplete="url"
          defaultValue={defaultUrl ?? ""}
          placeholder="https://yourbusiness.com"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </Field>

      <Field icon={Mail}>
        <input
          type="email"
          name="email"
          required
          inputMode="email"
          autoComplete="email"
          defaultValue={defaultEmail ?? ""}
          placeholder="you@yourbusiness.com"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </Field>

      <Field icon={Lock}>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Pick a password (8+ characters)"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </Field>

      <Submit variant={variant} />

      {state && !state.ok && (
        <p className="rounded-lg border border-signal/30 bg-signal/5 px-4 py-3 text-xs text-signal">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit({ variant }: { variant: Variant }) {
  const { pending } = useFormStatus();
  const label =
    variant === "trial" ? "Continue to Stripe" : "Continue to checkout";
  return (
    <Button
      type="submit"
      size="md"
      variant="primary"
      className="w-full"
      disabled={pending}
    >
      {pending ? "Taking you to Stripe…" : label}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  );
}

function Field({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
      <Icon className="h-4 w-4 shrink-0 text-accent" />
      {children}
    </label>
  );
}
