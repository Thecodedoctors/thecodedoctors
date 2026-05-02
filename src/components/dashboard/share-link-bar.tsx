"use client";

import { useState } from "react";
import { Copy, Check, Mail } from "lucide-react";

export function ShareLinkBar({ trialUrl }: { trialUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(trialUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user falls back to selecting text */
    }
  }

  const subject = encodeURIComponent(
    "Try The Code Doctors — they handle the website stuff so I don't"
  );
  const body = encodeURIComponent(
    `Hey,\n\nI've been using The Code Doctors for monitoring + ongoing fixes on my site. Thought you'd want a free 7-day trial — no card, real doctor on call:\n\n${trialUrl}\n\n— sent from your friend`
  );
  const mailto = `mailto:?subject=${subject}&body=${body}`;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          readOnly
          value={trialUrl}
          aria-label="Trial sign-up link"
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="flex-1 rounded-lg bg-background px-4 py-2.5 font-mono text-xs text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy link
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={mailto}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Mail className="h-3 w-3" />
          Share via email
        </a>
        <p className="text-xs text-muted">
          New sign-ups land in your list once they finish onboarding.
        </p>
      </div>
    </div>
  );
}
