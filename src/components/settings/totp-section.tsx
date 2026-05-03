"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  startTotpSetup,
  verifyAndEnableTotp,
  disableTotp,
  regenerateRecoveryCodes,
} from "@/server/two-factor";

type SetupBundle = {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
};

/**
 * Authenticator-app 2FA setup + status. Three states:
 *   - Off (totpEnabled=false): "Set up authenticator" button →
 *     starts setup → shows QR + secret + verify input
 *   - On (totpEnabled=true): status badge + "Disable" + "Regenerate
 *     recovery codes" actions
 *   - Recovery codes shown ONCE after successful enable / regenerate
 */
export function TotpSection({
  enabled,
  emailHint,
}: {
  enabled: boolean;
  emailHint: string;
}) {
  const [setup, setSetup] = useState<SetupBundle | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const [showDisable, setShowDisable] = useState(false);

  function startSetup() {
    setError(null);
    startTransition(async () => {
      try {
        const bundle = await startTotpSetup();
        setSetup(bundle);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't start setup. Try again in a moment."
        );
      }
    });
  }

  function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("code", code);
    startTransition(async () => {
      const res = await verifyAndEnableTotp(fd);
      if (res.ok) {
        setRecoveryCodes(res.recoveryCodes);
        setIsEnabled(true);
        setSetup(null);
        setCode("");
      } else {
        setError(res.error);
      }
    });
  }

  function onDisable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const password = new FormData(e.currentTarget).get("password");
    if (!password) return;
    const fd = new FormData();
    fd.set("password", String(password));
    startTransition(async () => {
      const res = await disableTotp(fd);
      if (res.ok) {
        setIsEnabled(false);
        setShowDisable(false);
      } else {
        setError(res.error);
      }
    });
  }

  function onRegenerate() {
    setError(null);
    startTransition(async () => {
      const res = await regenerateRecoveryCodes();
      if (res.ok) {
        setRecoveryCodes(res.recoveryCodes);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/30 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={
              "grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset " +
              (isEnabled
                ? "bg-success/10 text-success ring-success/30"
                : "bg-muted/10 text-muted ring-muted/20")
            }
          >
            {isEnabled ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <ShieldOff className="h-5 w-5" />
            )}
          </span>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Authenticator app
            </p>
            <h3 className="mt-1 text-base font-semibold tracking-tight">
              {isEnabled ? "Two-factor is on" : "Two-factor is off"}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {isEnabled
                ? "Sign-in requires a 6-digit code from your authenticator app on top of your password."
                : "Add an authenticator app to require a 6-digit code on every sign-in. Strongly recommended."}
            </p>
          </div>
        </div>
      </div>

      {/* Friendly walkthrough for first-timers — only shown when off + not in setup */}
      {!isEnabled && !setup && (
        <details className="mt-5 rounded-xl border border-border bg-background/40 p-4 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            Never used an authenticator app? Read this first.
          </summary>
          <div className="mt-3 space-y-2 text-muted">
            <p>
              An &ldquo;authenticator app&rdquo; runs on your phone and shows
              a fresh 6-digit code every 30 seconds. After setup, you&apos;ll
              type that code in addition to your password to sign in — so
              even if someone learns your password, they can&apos;t get in.
            </p>
            <p>
              <span className="text-foreground">Pick one app and install it:</span>{" "}
              <span className="font-mono">Google Authenticator</span> (free,
              works everywhere) ·{" "}
              <span className="font-mono">1Password</span> /
              <span className="font-mono"> iCloud Passwords</span> /
              <span className="font-mono"> Bitwarden</span> (built-in if you
              already use a password manager) ·{" "}
              <span className="font-mono">Authy</span> (multi-device backup).
            </p>
            <p>
              When you click <span className="font-mono">Set up authenticator</span>{" "}
              below, we&apos;ll show you a QR code. Open the app, tap
              &ldquo;Add account&rdquo; (or the +), point your camera at the
              QR code, and the app saves it. After that, type whatever
              6-digit code the app shows, and you&apos;re done.
            </p>
          </div>
        </details>
      )}

      {/* Action area */}
      {!isEnabled && !setup && (
        <div className="mt-5">
          <button
            type="button"
            onClick={startSetup}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee] disabled:opacity-60"
          >
            <Smartphone className="h-3.5 w-3.5" />
            {pending ? "Loading…" : "Set up authenticator"}
          </button>
        </div>
      )}

      {/* Setup wizard */}
      {!isEnabled && setup && (
        <SetupWizard
          setup={setup}
          code={code}
          setCode={setCode}
          onVerify={onVerify}
          pending={pending}
          emailHint={emailHint}
        />
      )}

      {/* Recovery codes — shown ONCE after enable / regenerate */}
      {recoveryCodes && (
        <RecoveryCodesPanel
          codes={recoveryCodes}
          onDismiss={() => setRecoveryCodes(null)}
        />
      )}

      {/* Enabled state — disable + regenerate */}
      {isEnabled && !recoveryCodes && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate recovery codes
          </button>
          {!showDisable ? (
            <button
              type="button"
              onClick={() => setShowDisable(true)}
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-signal/30 px-3.5 py-1.5 text-xs font-medium text-signal transition-colors hover:bg-signal/10"
            >
              <ShieldOff className="h-3 w-3" />
              Disable
            </button>
          ) : (
            <form
              onSubmit={onDisable}
              className="ml-auto flex flex-wrap items-center gap-2"
            >
              <input
                type="password"
                name="password"
                placeholder="Current password"
                required
                autoFocus
                className="rounded-md bg-background px-3 py-1.5 text-xs text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
              />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-signal px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-signal/90"
              >
                {pending ? "Disabling…" : "Confirm disable"}
              </button>
              <button
                type="button"
                onClick={() => setShowDisable(false)}
                className="text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <p className="text-xs text-foreground">{error}</p>
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function SetupWizard({
  setup,
  code,
  setCode,
  onVerify,
  pending,
  emailHint,
}: {
  setup: SetupBundle;
  code: string;
  setCode: (s: string) => void;
  onVerify: (e: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  emailHint: string;
}) {
  return (
    <div className="mt-6 grid gap-6 rounded-xl border border-accent/30 bg-accent-soft/15 p-5 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-3">
        <img
          src={setup.qrCodeDataUrl}
          alt="Scan with your authenticator app"
          width={220}
          height={220}
          className="rounded-md ring-1 ring-inset ring-border-strong"
        />
        <CopySecret secret={setup.secret} />
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          Step 1 · Scan
        </p>
        <p className="mt-1 text-sm text-foreground">
          Open your authenticator app, tap{" "}
          <span className="font-mono">Add account</span>, and point the camera
          at the QR. The app will list it as{" "}
          <span className="font-mono">Code Doctors ({emailHint})</span>.
        </p>
        <p className="mt-3 text-xs text-muted">
          Can&apos;t scan? Tap &ldquo;Enter manually&rdquo; in your app and
          paste the secret above.
        </p>

        <form onSubmit={onVerify} className="mt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            Step 2 · Verify
          </p>
          <p className="mt-1 mb-3 text-sm text-foreground">
            Type the 6-digit code your app is showing right now.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-32 rounded-md bg-background px-3 py-2 font-mono text-base tracking-widest text-foreground outline-none ring-1 ring-inset ring-border focus:ring-signal"
            />
            <button
              type="submit"
              disabled={pending || code.length !== 6}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee] disabled:opacity-60"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {pending ? "Verifying…" : "Turn on 2FA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CopySecret({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(secret).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined
    );
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-background px-2.5 py-1 font-mono text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
      title="Copy the secret to paste into your app"
    >
      {copied ? (
        <Check className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {secret.slice(0, 4)} {secret.slice(4, 8)} {secret.slice(8, 12)} …
    </button>
  );
}

function RecoveryCodesPanel({
  codes,
  onDismiss,
}: {
  codes: string[];
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function copyAll() {
    navigator.clipboard.writeText(codes.join("\n")).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined
    );
  }
  return (
    <div className="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning ring-1 ring-inset ring-warning/30">
          <KeyRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-warning">
            Save these recovery codes
          </p>
          <p className="mt-1 text-sm text-foreground">
            Each code lets you sign in <span className="font-medium">once</span>{" "}
            if you lose your phone. We can&apos;t show them again — copy them
            into your password manager or print this page.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {codes.map((c) => (
              <li
                key={c}
                className="rounded-md bg-background px-3 py-2 font-mono text-sm text-foreground ring-1 ring-inset ring-border"
              >
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#e6e9ee]"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy all"}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-muted hover:text-foreground"
            >
              I&apos;ve saved them
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
