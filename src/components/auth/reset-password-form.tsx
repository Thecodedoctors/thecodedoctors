"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Mail, KeyRound, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyResetCodeAndSetPassword } from "@/server/password-reset";

export function ResetPasswordForm({ defaultEmail }: { defaultEmail: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Both passwords need to match.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await verifyResetCodeAndSetPassword(fd);
      if (!res.ok) {
        setError(res.error);
      }
      // On success, server action redirects to /login?reset=1.
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
        <Mail className="h-4 w-4 shrink-0 text-accent" />
        <input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
          placeholder="you@yourcompany.com"
          aria-label="Email"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </label>

      <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
        <KeyRound className="h-4 w-4 shrink-0 text-accent" />
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="6-digit code"
          aria-label="6-digit code from email"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full bg-transparent font-mono tracking-widest text-foreground outline-none placeholder:text-muted placeholder:font-sans placeholder:tracking-normal text-sm"
        />
      </label>

      <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
        <Lock className="h-4 w-4 shrink-0 text-accent" />
        <input
          type="password"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="New password (8+ chars)"
          aria-label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </label>

      <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
        <Lock className="h-4 w-4 shrink-0 text-accent" />
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Confirm new password"
          aria-label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </label>

      <Button
        type="submit"
        size="md"
        variant="primary"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Setting password…" : "Set new password"}
        <ArrowRight className="h-4 w-4" />
      </Button>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <p className="text-xs text-foreground">{error}</p>
        </div>
      )}
    </form>
  );
}
