import { ShieldCheck, Lock, Activity, Zap, FileCheck2 } from "lucide-react";

const items = [
  { icon: Lock, label: "SSL Labs A+" },
  { icon: ShieldCheck, label: "Mozilla Observatory A+" },
  { icon: Activity, label: "DMARC enforced" },
  { icon: Zap, label: "Cloudflare-protected" },
  { icon: FileCheck2, label: "GDPR-aware" },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Security and trust"
      className="reveal border-b border-border/60 bg-surface/30"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10">
        <div className="flex flex-col items-center justify-center gap-x-10 gap-y-4 text-muted md:flex-row md:flex-wrap">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted/70">
            We eat our own cooking
          </p>
          {items.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 text-sm"
            >
              <Icon className="h-4 w-4 text-accent" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
