"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { cn } from "@/lib/cn";
import { CLIENT_NAV, ADMIN_NAV, type NavItem, type NavSection } from "./nav-config";

type Variant = "client" | "admin";

export function AppSidebar({
  variant,
  className,
}: {
  variant: Variant;
  className?: string;
}) {
  const pathname = usePathname();
  const current = normalizePath(pathname);
  const sections = variant === "admin" ? ADMIN_NAV : CLIENT_NAV;
  const accentClass = variant === "admin" ? "text-signal" : "text-accent";
  const wordmark = variant === "admin" ? "Practice" : "Patient Portal";

  return (
    <aside
      className={cn(
        "hidden md:flex md:w-[220px] md:flex-col md:shrink-0 md:border-r md:border-border/60 md:bg-surface/40",
        className
      )}
      aria-label={`${variant === "admin" ? "Practice" : "Patient"} navigation`}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border/60 px-5">
        <span
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md bg-surface ring-1 ring-border-strong",
            accentClass
          )}
          aria-hidden
        >
          <Stethoscope className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold tracking-tight">{wordmark}</span>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {sections.map((section) => (
          <NavSectionBlock
            key={section.heading ?? "_"}
            section={section}
            current={current}
            accentClass={accentClass}
          />
        ))}
      </nav>
    </aside>
  );
}

function NavSectionBlock({
  section,
  current,
  accentClass,
}: {
  section: NavSection;
  current: string;
  accentClass: string;
}) {
  return (
    <div>
      {section.heading && (
        <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {section.heading}
        </p>
      )}
      <ul className="space-y-0.5">
        {section.items.map((item) => (
          <li key={item.href}>
            <NavLinkRow item={item} current={current} accentClass={accentClass} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavLinkRow({
  item,
  current,
  accentClass,
}: {
  item: NavItem;
  current: string;
  accentClass: string;
}) {
  const Icon = item.icon;
  const active = isActive(item.href, current);

  if (item.soon) {
    return (
      <span
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted/60 cursor-default"
        aria-disabled="true"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full bg-muted/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
          soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-foreground/5 text-foreground"
          : "text-muted hover:text-foreground hover:bg-surface"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? accentClass : "text-current"
        )}
      />
      <span>{item.label}</span>
    </Link>
  );
}

function normalizePath(pathname: string): string {
  if (pathname.startsWith("/dashboard"))
    return pathname.slice("/dashboard".length) || "/";
  if (pathname.startsWith("/admin"))
    return pathname.slice("/admin".length) || "/";
  return pathname;
}

function isActive(href: string, current: string): boolean {
  if (href === "/") return current === "/";
  return current === href || current.startsWith(href + "/");
}
