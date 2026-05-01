import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({
  children,
  className,
  id,
  size = "md",
  reveal = true,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  size?: "sm" | "md" | "lg";
  reveal?: boolean;
}) {
  const padding =
    size === "sm" ? "py-16 md:py-20" : size === "lg" ? "py-28 md:py-40" : "py-20 md:py-28";
  return (
    <section
      id={id}
      className={cn("relative w-full", padding, reveal && "reveal", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-6 md:px-10">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-12 md:mb-16 max-w-3xl", className)}>
      {eyebrow && (
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-base md:text-lg text-muted leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
