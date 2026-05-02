import { Section } from "@/components/ui/section";
import { SettingsNav, type SettingsTab } from "./settings-nav";

export function SettingsShell({
  current,
  basePath,
  accent,
  title,
  description,
  children,
}: {
  current: SettingsTab;
  basePath: string;
  accent: "accent" | "signal";
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const eyebrow = accent === "accent" ? "text-accent" : "text-signal";

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-3xl">
        <p
          className={`font-mono text-xs uppercase tracking-[0.18em] ${eyebrow}`}
        >
          Settings
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm text-muted">{description}</p>
        )}

        <div className="mt-8">
          <SettingsNav current={current} basePath={basePath} accent={accent} />
          <div className="rounded-2xl border border-border-strong bg-surface/30 p-6 sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </Section>
  );
}
