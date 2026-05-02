import type { ReactNode } from "react";

/**
 * Brand-styled prose primitives for knowledge-base articles. Keeps the
 * writing surface narrow and predictable — no Tailwind prose plugin
 * needed, no random heading sizes drifting between articles.
 */

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-semibold tracking-tight md:text-2xl">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold tracking-tight">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-base leading-relaxed text-foreground/90">
      {children}
    </p>
  );
}

export function Em({ children }: { children: ReactNode }) {
  return <em className="text-foreground">{children}</em>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}

export function Ul({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 space-y-2 text-base text-foreground/90">{children}</ul>
  );
}

export function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 leading-relaxed">
      <span
        aria-hidden
        className="mt-2.5 h-1 w-3 shrink-0 rounded-full bg-accent"
      />
      <span>{children}</span>
    </li>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.92em] text-foreground ring-1 ring-inset ring-border">
      {children}
    </code>
  );
}

export function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="mt-6 border-l-2 border-accent bg-accent-soft/30 px-5 py-4 text-base leading-relaxed text-foreground/90">
      {children}
    </blockquote>
  );
}

export function CalloutTip({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="mt-6 rounded-2xl border border-border-strong bg-surface/50 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
        {title}
      </p>
      <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
        {children}
      </div>
    </aside>
  );
}
