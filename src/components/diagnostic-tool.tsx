"use client";

import { useState, useTransition, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, ArrowRight, Lock, AlertCircle } from "lucide-react";
import type { CheckupReport } from "@/lib/checkup/types";
import { Button } from "@/components/ui/button";
import { DiagnosticResults } from "@/components/diagnostic-results";
import { TurnstileGate } from "@/components/turnstile-gate";

type State =
  | { kind: "idle" }
  | { kind: "scanning"; url: string }
  | { kind: "results"; report: CheckupReport }
  | { kind: "error"; message: string };

export function DiagnosticTool() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [url, setUrl] = useState("");
  const [tsToken, setTsToken] = useState<string>("");
  const [pending, startTransition] = useTransition();

  // Site key absent (dev) → captcha is non-blocking; pretend we have a token.
  const captchaConfigured = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
  const captchaReady = !captchaConfigured || Boolean(tsToken);

  function reset() {
    setState({ kind: "idle" });
    setUrl("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!url.trim()) return;
    if (!captchaReady) {
      setState({
        kind: "error",
        message: "Please complete the captcha and try again.",
      });
      return;
    }
    setState({ kind: "scanning", url: url.trim() });

    startTransition(async () => {
      try {
        const res = await fetch("/api/checkup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            turnstileToken: tsToken,
          }),
        });
        const data = (await res.json()) as
          | CheckupReport
          | { error: string; message: string };

        if (!res.ok || "error" in data) {
          setState({
            kind: "error",
            message:
              "message" in data
                ? data.message
                : "Something went wrong on our end.",
          });
          return;
        }
        setState({ kind: "results", report: data });
      } catch {
        setState({
          kind: "error",
          message: "We couldn't reach our scan service. Please try again.",
        });
      }
    });
  }

  return (
    <div className="relative">
      {/* initial={false} so the first server-rendered state mounts at its
          animate values (visible). Without this, motion renders opacity: 0
          on the server and the form is invisible until the client-side
          animation runs — which can flicker or fail to fire under React's
          concurrent rendering. */}
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <UrlForm
              url={url}
              setUrl={setUrl}
              onSubmit={handleSubmit}
              pending={pending}
              onTurnstileToken={setTsToken}
            />
          </motion.div>
        )}

        {state.kind === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ScanningState url={state.url} />
          </motion.div>
        )}

        {state.kind === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ErrorState message={state.message} onRetry={reset} />
          </motion.div>
        )}

        {state.kind === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <DiagnosticResults report={state.report} onScanAnother={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UrlForm({
  url,
  setUrl,
  onSubmit,
  pending,
  onTurnstileToken,
}: {
  url: string;
  setUrl: (s: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  onTurnstileToken: (t: string) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border-strong bg-surface/60 p-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
          <Activity className="h-4 w-4 shrink-0 text-accent" />
          <input
            type="text"
            name="url"
            inputMode="url"
            autoComplete="url"
            required
            placeholder="yourwebsite.com"
            aria-label="Website URL"
            className="w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={pending}
          />
        </label>
        <Button
          type="submit"
          size="md"
          variant="primary"
          className="sm:w-auto"
          disabled={pending}
        >
          {pending ? "Running…" : "Run Checkup"}
          {!pending && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
      <div className="mt-3 px-2">
        <TurnstileGate onToken={onTurnstileToken} />
      </div>
      <p className="mt-3 inline-flex items-center gap-2 px-2 py-1 text-xs text-muted">
        <Lock className="h-3.5 w-3.5 text-accent" />
        We don&apos;t store the URLs we scan. Email is only collected if you
        request the full report.
      </p>
    </form>
  );
}

function ScanningState({ url }: { url: string }) {
  return (
    <div className="rounded-2xl border border-border-strong bg-surface/60 p-8 md:p-10">
      <div className="flex items-center gap-4">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Diagnosing
        </p>
      </div>
      <p className="mt-4 break-all font-mono text-sm text-muted">{url}</p>
      <ul className="mt-8 space-y-2.5">
        <ScanningStep label="Resolving domain & checking transport" delay={0} />
        <ScanningStep label="Inspecting security headers" delay={400} />
        <ScanningStep label="Reading HTML & meta tags" delay={900} />
        <ScanningStep label="Probing DNS & email posture" delay={1500} />
        <ScanningStep label="Looking for trackers & privacy gaps" delay={2200} />
        <ScanningStep label="Measuring performance" delay={2900} />
      </ul>
    </div>
  );
}

function ScanningStep({ label, delay }: { label: string; delay: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay / 1000, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 font-mono text-sm text-muted"
    >
      <motion.span
        className="block h-1.5 w-1.5 rounded-full bg-accent"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: delay / 1000 }}
      />
      {label}
    </motion.li>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border-strong bg-surface/60 p-8">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-signal" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
            Couldn&apos;t complete the checkup
          </p>
          <p className="mt-2 text-foreground">{message}</p>
        </div>
      </div>
      <div className="mt-6">
        <Button onClick={onRetry} variant="secondary" size="md">
          Try a different URL
        </Button>
      </div>
    </div>
  );
}
