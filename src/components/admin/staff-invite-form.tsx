"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Mail, Stethoscope, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { inviteStaffMember, type InviteResult } from "@/server/staff-onboard";

type Banner =
  | { kind: "success"; mode: "created" | "promoted"; email: string }
  | { kind: "error"; message: string };

/**
 * Founder-only form that invites a new staff member or promotes an
 * existing user. Server action does the work; this just owns the form
 * state + the in-page result banner.
 */
export function StaffInviteForm() {
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"doctor" | "senior_doctor" | "readonly">(
    "doctor"
  );

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);
    fd.set("role", role);
    startTransition(async () => {
      try {
        const result: InviteResult = await inviteStaffMember(fd);
        if (result.ok) {
          setBanner({ kind: "success", mode: result.mode, email: result.email });
          setName("");
          setEmail("");
          setRole("doctor");
        } else {
          setBanner({ kind: "error", message: result.error });
        }
      } catch (err) {
        setBanner({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "Something went wrong on our end.",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Email"
          icon={Mail}
          input={
            <input
              type="email"
              required
              autoComplete="off"
              inputMode="email"
              placeholder="doctor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            />
          }
        />

        <Field
          label="Name (optional)"
          icon={Stethoscope}
          input={
            <input
              type="text"
              autoComplete="off"
              placeholder="Dr. Reyes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            />
          }
        />

        <fieldset>
          <legend className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Role
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <RoleOption
              value="doctor"
              label="Doctor"
              hint="Triage + treat requests, message patients."
              checked={role === "doctor"}
              onChange={() => setRole("doctor")}
              disabled={pending}
            />
            <RoleOption
              value="senior_doctor"
              label="Senior doctor"
              hint="All doctor powers, plus archive + reassign."
              checked={role === "senior_doctor"}
              onChange={() => setRole("senior_doctor")}
              disabled={pending}
            />
            <RoleOption
              value="readonly"
              label="Read-only"
              hint="Can view everything; can't change anything."
              checked={role === "readonly"}
              onChange={() => setRole("readonly")}
              disabled={pending}
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee] disabled:opacity-60"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {pending ? "Sending invite…" : "Send invite"}
          </button>
          <p className="text-xs text-muted">
            Existing users get promoted; new emails get a temp password by
            email.
          </p>
        </div>
      </form>

      {banner?.kind === "success" && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
                {banner.mode === "created" ? "Invite sent" : "Role updated"}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {banner.mode === "created" ? (
                  <>
                    A welcome email with a temporary password is on the way to{" "}
                    <span className="font-mono">{banner.email}</span>.
                  </>
                ) : (
                  <>
                    <span className="font-mono">{banner.email}</span> is now
                    staff. They'll see the practice portal next time they sign
                    in.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {banner?.kind === "error" && (
        <div className="rounded-xl border border-signal/30 bg-signal/5 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
            <p className="text-sm text-foreground">{banner.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Field({
  label,
  icon: Icon,
  input,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <span className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-signal">
        <Icon className="h-4 w-4 shrink-0 text-signal" />
        {input}
      </span>
    </label>
  );
}

function RoleOption({
  value,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  value: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <label
      className={`group flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition-colors ${
        checked
          ? "border-signal bg-signal/5"
          : "border-border bg-surface/40 hover:border-signal/40"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        type="radio"
        name="role"
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs leading-relaxed text-muted">{hint}</span>
    </label>
  );
}
