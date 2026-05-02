"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createRequest } from "@/server/requests";

const TYPES = [
  { value: "improvement", label: "Improvement" },
  { value: "bug", label: "Bug fix" },
  { value: "security", label: "Security" },
  { value: "seo", label: "SEO" },
  { value: "performance", label: "Performance" },
  { value: "redesign", label: "Redesign" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function RequestForm({
  knownUrls = [],
}: {
  /** URLs we already know for this client (apex websiteUrl + past requests).
   *  When non-empty, the form renders a dropdown; otherwise a free-text input. */
  knownUrls?: string[];
}) {
  const [state, action] = useActionState(createRequest, null);

  return (
    <form action={action} className="space-y-6">
      <Field
        label="Title"
        name="title"
        required
        minLength={3}
        maxLength={200}
        placeholder="What's the symptom? (e.g., Checkout takes 8 seconds to load)"
        autoFocus
      />

      <UrlField knownUrls={knownUrls} />

      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Type" name="type" defaultValue="improvement" options={TYPES} />
        <SelectField label="Priority" name="priority" defaultValue="medium" options={PRIORITIES} />
      </div>

      <Field
        label="Describe what's wrong"
        name="description"
        required
        minLength={10}
        maxLength={5000}
        textarea
        rows={6}
        placeholder="What you saw, what you expected, when it started, anything else we should know."
      />

      {state && !state.ok && (
        <div className="flex items-start gap-3 rounded-lg border border-signal/30 bg-signal/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <p className="text-sm text-foreground">{state.error}</p>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

/**
 * Site URL: dropdown when we know URLs for this client (apex websiteUrl +
 * past request URLs), text input otherwise. Picking "Use a different URL…"
 * switches the dropdown into a text input. Phase 4 will move URL collection
 * to sign-up entirely; this component is the interim. See spec §11 q9.
 */
function UrlField({ knownUrls }: { knownUrls: string[] }) {
  const [mode, setMode] = useState<"select" | "free">(
    knownUrls.length > 0 ? "select" : "free"
  );
  const [selected, setSelected] = useState<string>(knownUrls[0] ?? "");

  if (mode === "free") {
    return (
      <Field
        label="Site URL"
        name="url"
        type="text"
        placeholder="yourwebsite.com or specific page"
        helperText={
          knownUrls.length > 0
            ? `Or pick a known URL.`
            : `Optional. Helps us reproduce the issue faster.`
        }
      />
    );
  }

  return (
    <div>
      <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.14em] text-muted">
          Site URL
        </span>
        <select
          name="url"
          value={selected}
          onChange={(e) => {
            if (e.target.value === "__other__") {
              setMode("free");
              setSelected("");
            } else {
              setSelected(e.target.value);
            }
          }}
          className="w-full rounded-lg bg-background px-4 py-3 text-base text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
        >
          {knownUrls.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
          <option value="__other__">Use a different URL…</option>
        </select>
      </label>
      <p className="mt-2 text-xs text-muted">
        Picking the right URL helps a doctor reproduce the issue quickly.
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  minLength,
  maxLength,
  placeholder,
  helperText,
  textarea,
  rows,
  autoFocus,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  helperText?: string;
  textarea?: boolean;
  rows?: number;
  autoFocus?: boolean;
}) {
  const inputClass =
    "w-full rounded-lg bg-background px-4 py-3 text-base text-foreground outline-none ring-1 ring-inset ring-border placeholder:text-muted focus:ring-accent";
  return (
    <div>
      <label className="block">
        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {label}
          {required && <span className="text-accent"> *</span>}
        </span>
        {textarea ? (
          <textarea
            name={name}
            required={required}
            minLength={minLength}
            maxLength={maxLength}
            placeholder={placeholder}
            rows={rows ?? 4}
            className={`${inputClass} resize-y`}
          />
        ) : (
          <input
            type={type}
            name={name}
            required={required}
            minLength={minLength}
            maxLength={maxLength}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={inputClass}
          />
        )}
      </label>
      {helperText && (
        <p className="mt-2 text-xs text-muted">{helperText}</p>
      )}
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-xs uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg bg-background px-4 py-3 text-base text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-xs text-muted">
        Triage usually within one business day · all messages encrypted in
        transit
      </p>
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Submitting…" : "Submit request"}
        {!pending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
