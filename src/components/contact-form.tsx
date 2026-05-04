"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Script from "next/script";
import {
  ArrowRight,
  User,
  Mail,
  Phone,
  Briefcase,
  Globe,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Inquiry form on /book. Submits to /api/contact, which persists the
 * lead, emails the practice, and rate-limits by IP.
 *
 * Cloudflare Turnstile renders a managed challenge widget below the
 * form fields; the token it produces is passed to the server, which
 * verifies against challenges.cloudflare.com. The widget loads via
 * `next/script` so it doesn't block paint.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ContactForm() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [tsToken, setTsToken] = useState<string>("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  // Render the Turnstile widget once the script + the host element are
  // both ready. Watching tsScriptReady + the ref lets us do this idempotently
  // without re-rendering on every keystroke.
  const [tsScriptReady, setTsScriptReady] = useState(false);
  useEffect(() => {
    if (!tsScriptReady) return;
    if (!siteKey) return;
    if (!widgetRef.current) return;
    if (widgetIdRef.current) return; // already rendered
    if (!window.turnstile) return;

    widgetIdRef.current = window.turnstile.render(widgetRef.current, {
      sitekey: siteKey,
      callback: (token) => setTsToken(token),
      "expired-callback": () => setTsToken(""),
      "error-callback": () => setTsToken(""),
      theme: "dark",
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [tsScriptReady, siteKey]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;

    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      position: String(fd.get("position") ?? ""),
      companyWebsite: String(fd.get("companyWebsite") ?? ""),
      subject: String(fd.get("subject") ?? ""),
      message: String(fd.get("message") ?? ""),
      turnstileToken: tsToken,
    };

    // Client-side guard so the user gets feedback BEFORE waiting on the
    // server round-trip when the captcha hasn't been completed.
    if (siteKey && !tsToken) {
      setState({
        kind: "error",
        message: "Please complete the captcha below before submitting.",
      });
      return;
    }

    setState({ kind: "submitting" });
    let res: Response;
    try {
      res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setState({
        kind: "error",
        message: "Couldn't reach the server. Check your connection and try again.",
      });
      return;
    }

    let body: { ok?: boolean; message?: string; error?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }

    if (res.ok && body.ok) {
      setState({
        kind: "success",
        message: body.message ?? "Message sent.",
      });
      // Reset the widget so the user can submit again later if they
      // need to (rare for a contact form, but cheap to do right).
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTsToken("");
      }
      e.currentTarget.reset();
      return;
    }

    setState({
      kind: "error",
      message:
        body.message ??
        "Something went wrong. Please try again in a moment.",
    });
    // Reset the widget if the server rejected the captcha so the user
    // gets a fresh challenge instead of a stuck one.
    if (
      widgetIdRef.current &&
      window.turnstile &&
      body.error === "captcha-failed"
    ) {
      window.turnstile.reset(widgetIdRef.current);
      setTsToken("");
    }
  }

  if (state.kind === "success") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-7">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/15 text-success ring-1 ring-inset ring-success/30">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
              Message sent
            </p>
            <p className="mt-2 text-sm text-foreground">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
          onReady={() => setTsScriptReady(true)}
          onLoad={() => setTsScriptReady(true)}
        />
      )}

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-border-strong bg-surface/40 p-6 md:p-8"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={User} label="First name">
            <input
              type="text"
              name="firstName"
              required
              maxLength={80}
              autoComplete="given-name"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              placeholder="Jane"
            />
          </Field>
          <Field icon={User} label="Last name">
            <input
              type="text"
              name="lastName"
              required
              maxLength={80}
              autoComplete="family-name"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              placeholder="Doe"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={Mail} label="Email">
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              inputMode="email"
              autoComplete="email"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              placeholder="you@yourbusiness.com"
            />
          </Field>
          <Field icon={Phone} label="Phone">
            <input
              type="tel"
              name="phone"
              required
              maxLength={40}
              inputMode="tel"
              autoComplete="tel"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              placeholder="+1 555 123 4567"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={Briefcase} label="Position">
            <input
              type="text"
              name="position"
              required
              maxLength={120}
              autoComplete="organization-title"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              placeholder="Founder, Marketing, Ops…"
            />
          </Field>
          <Field icon={Globe} label="Company website">
            <input
              type="text"
              name="companyWebsite"
              required
              maxLength={256}
              inputMode="url"
              autoComplete="url"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              placeholder="yourbusiness.com"
            />
          </Field>
        </div>

        <Field icon={MessageSquare} label="Subject">
          <input
            type="text"
            name="subject"
            required
            maxLength={200}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            placeholder="What's this about?"
          />
        </Field>

        <Field icon={MessageSquare} label="Message" multiline>
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={4000}
            rows={6}
            className="w-full resize-y bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            placeholder="Tell us what you're looking for, what's working, what isn't."
          />
        </Field>

        {/* Turnstile widget. Cloudflare manages the challenge UI; we
            just give it a host element. If TURNSTILE_SITE_KEY isn't
            configured (dev) we render a placeholder so users still see
            the form has a captcha gate. */}
        <div className="mt-2 flex flex-col gap-2">
          {siteKey ? (
            <div ref={widgetRef} className="cf-turnstile-host" />
          ) : (
            <p className="rounded-xl border border-dashed border-border-strong bg-background/40 px-4 py-3 font-mono text-[11px] text-muted">
              [captcha disabled — TURNSTILE_SITE_KEY not configured]
            </p>
          )}
        </div>

        {state.kind === "error" && (
          <div className="flex items-start gap-3 rounded-xl border border-signal/30 bg-signal/5 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
            <p className="text-sm text-foreground">{state.message}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="mt-2 w-full sm:w-auto sm:self-start"
          disabled={state.kind === "submitting"}
        >
          {state.kind === "submitting" ? "Sending…" : "Send message"}
          {state.kind !== "submitting" && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>
    </>
  );
}

function Field({
  icon: Icon,
  label,
  multiline,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  multiline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <div
        className={`flex ${
          multiline ? "items-start" : "items-center"
        } gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 text-accent ${multiline ? "mt-0.5" : ""}`}
        />
        {children}
      </div>
    </label>
  );
}
