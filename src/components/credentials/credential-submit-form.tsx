"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ShieldCheck, AlertCircle } from "lucide-react";
import {
  submitCredentialRequest,
  type FieldKind,
} from "@/server/credentials";

type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  placeholder?: string;
};

/**
 * Patient credential submission. Client component using useActionState
 * so a validation error renders INLINE with the form still mounted —
 * the user's typed (often un-resaveable) secrets are preserved, no
 * page reload, no silent dead-end. Only success redirects.
 */
export function CredentialSubmitForm({
  requestId,
  fields,
}: {
  requestId: string;
  fields: Field[];
}) {
  const [state, action] = useActionState(submitCredentialRequest, null);

  return (
    <form
      action={action}
      className="mt-8 space-y-5 rounded-2xl border border-border bg-surface/30 p-6"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div className="rounded-xl border border-accent/30 bg-accent-soft/15 p-4 text-sm">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-foreground">
            Heads up:{" "}
            <span className="text-foreground">
              once you submit, you won&apos;t be able to see these values
              again.
            </span>{" "}
            <span className="text-muted">
              Make sure they&apos;re correct before clicking submit. We treat
              this as a one-way deposit so a stale browser or screenshot
              can&apos;t leak the values.
            </span>
          </p>
        </div>
      </div>

      {fields.map((f) => (
        <FieldInput key={f.key} field={f} />
      ))}

      {state && !state.ok && (
        <div className="flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <p className="text-xs text-foreground">{state.error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton />
        <p className="text-xs text-muted">
          Encrypted on our servers · founder-only · every read is logged.
        </p>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee] disabled:opacity-60 disabled:pointer-events-none"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {pending ? "Submitting…" : "Submit credentials"}
    </button>
  );
}

function FieldInput({ field }: { field: Field }) {
  const labelEl = (
    <span className="mb-2 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
      <span>{field.label}</span>
      {field.required ? (
        <span className="text-accent">required</span>
      ) : (
        <span>optional</span>
      )}
    </span>
  );

  if (field.kind === "multiline") {
    return (
      <label className="block">
        {labelEl}
        <textarea
          name={field.key}
          required={field.required}
          rows={4}
          maxLength={5000}
          placeholder={field.placeholder ?? ""}
          autoComplete="off"
          className="w-full resize-y rounded-lg bg-background px-3 py-3 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
        />
      </label>
    );
  }

  const inputType =
    field.kind === "password" || field.kind === "api_key"
      ? "password"
      : field.kind === "url"
        ? "url"
        : "text";

  return (
    <label className="block">
      {labelEl}
      <input
        type={inputType}
        name={field.key}
        required={field.required}
        maxLength={5000}
        placeholder={field.placeholder ?? ""}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-lg bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
      />
    </label>
  );
}
