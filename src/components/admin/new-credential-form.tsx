"use client";

import { useState } from "react";
import { Plus, Trash2, KeyRound, Globe, Database, Code, Wand2 } from "lucide-react";
import { createCredentialRequest } from "@/server/credentials";

type FieldKind = "text" | "password" | "url" | "multiline" | "api_key";

type Field = {
  label: string;
  kind: FieldKind;
  required: boolean;
};

type Template = {
  id: string;
  name: string;
  description: string;
  icon: typeof KeyRound;
  defaultTitle: string;
  defaultDescription: string;
  fields: Field[];
};

const TEMPLATES: Template[] = [
  {
    id: "hosting",
    name: "Hosting login",
    description: "cPanel / WP Engine / Kinsta / etc.",
    icon: Database,
    defaultTitle: "Hosting login",
    defaultDescription:
      "We need access to your hosting control panel to apply updates and run a backup.",
    fields: [
      { label: "Hosting URL", kind: "url", required: true },
      { label: "Username", kind: "text", required: true },
      { label: "Password", kind: "password", required: true },
      { label: "Notes", kind: "multiline", required: false },
    ],
  },
  {
    id: "registrar",
    name: "Domain registrar",
    description: "GoDaddy, Namecheap, Cloudflare Registrar.",
    icon: Globe,
    defaultTitle: "Domain registrar",
    defaultDescription:
      "We need temporary access to update DNS records and check transfer locks.",
    fields: [
      { label: "Registrar URL", kind: "url", required: true },
      { label: "Username", kind: "text", required: true },
      { label: "Password", kind: "password", required: true },
      { label: "2FA backup code (if any)", kind: "password", required: false },
      { label: "Notes", kind: "multiline", required: false },
    ],
  },
  {
    id: "wordpress",
    name: "WordPress admin",
    description: "Site /wp-admin login.",
    icon: KeyRound,
    defaultTitle: "WordPress admin",
    defaultDescription:
      "We need a WP admin login to update plugins and theme.",
    fields: [
      { label: "Site URL", kind: "url", required: true },
      { label: "Username", kind: "text", required: true },
      { label: "Password", kind: "password", required: true },
    ],
  },
  {
    id: "api_key",
    name: "API key",
    description: "Stripe, Mailgun, Cloudflare API token, etc.",
    icon: Code,
    defaultTitle: "API key",
    defaultDescription:
      "We need an API key to integrate / verify a service. Limit scope when possible.",
    fields: [
      { label: "Provider", kind: "text", required: true },
      { label: "API key", kind: "api_key", required: true },
      { label: "Notes", kind: "multiline", required: false },
    ],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Build your own field list.",
    icon: Wand2,
    defaultTitle: "",
    defaultDescription: "",
    fields: [{ label: "", kind: "text", required: true }],
  },
];

export function NewCredentialForm({ clientId }: { clientId: string }) {
  const [templateId, setTemplateId] = useState<string>("hosting");
  const tpl = TEMPLATES.find((t) => t.id === templateId)!;
  const [title, setTitle] = useState(tpl.defaultTitle);
  const [description, setDescription] = useState(tpl.defaultDescription);
  const [fields, setFields] = useState<Field[]>(tpl.fields);

  function pickTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setTitle(t.defaultTitle);
    setDescription(t.defaultDescription);
    setFields(t.fields.map((f) => ({ ...f })));
  }

  function updateField(idx: number, patch: Partial<Field>) {
    setFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    );
  }
  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }
  function addField() {
    if (fields.length >= 12) return;
    setFields((prev) => [...prev, { label: "", kind: "text", required: false }]);
  }

  return (
    <form action={createCredentialRequest} className="space-y-6">
      <input type="hidden" name="clientId" value={clientId} />

      {/* Template picker */}
      <fieldset>
        <legend className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Template
        </legend>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            const active = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t.id)}
                className={
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors " +
                  (active
                    ? "border-signal bg-signal/5"
                    : "border-border bg-surface/40 hover:border-signal/40")
                }
              >
                <Icon className="h-4 w-4 text-signal" />
                <span className="text-sm font-medium text-foreground">
                  {t.name}
                </span>
                <span className="text-xs text-muted leading-snug">
                  {t.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Title (visible to the patient)
        </span>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Hosting login for example.com"
          className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
        />
      </label>

      <label className="block">
        <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          What you&apos;ll do with this (visible to the patient)
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Briefly explain why you need this and what you'll do."
          className="w-full resize-y rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
        />
      </label>

      <fieldset>
        <legend className="mb-3 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          <span>Fields the patient will fill</span>
          <span className="text-[10px] text-muted normal-case tracking-normal">
            up to 12
          </span>
        </legend>
        <ul className="space-y-2">
          {fields.map((f, i) => (
            <li
              key={i}
              className="grid gap-2 rounded-lg border border-border bg-background/40 p-3 sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <input
                type="text"
                name="fieldLabels"
                required
                maxLength={80}
                value={f.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Label (e.g. Site URL)"
                className="rounded-md bg-background px-3 py-1.5 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
              />
              <select
                name="fieldKinds"
                value={f.kind}
                onChange={(e) =>
                  updateField(i, { kind: e.target.value as FieldKind })
                }
                className="rounded-md bg-background px-3 py-1.5 text-xs text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
              >
                <option value="text">Text</option>
                <option value="password">Password</option>
                <option value="url">URL</option>
                <option value="api_key">API key</option>
                <option value="multiline">Long text</option>
              </select>
              <label className="flex items-center gap-1.5 px-2 text-xs text-muted">
                <input
                  type="checkbox"
                  name="fieldRequired"
                  checked={f.required}
                  onChange={(e) =>
                    updateField(i, { required: e.target.checked })
                  }
                  value="true"
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => removeField(i)}
                aria-label="Remove field"
                disabled={fields.length === 1}
                className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-signal/10 hover:text-signal disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addField}
          disabled={fields.length >= 12}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Add field
        </button>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Create + email patient
        </button>
        <p className="text-xs text-muted">
          Patient gets a notification with a link. You&apos;ll get one back
          when they submit.
        </p>
      </div>
    </form>
  );
}
