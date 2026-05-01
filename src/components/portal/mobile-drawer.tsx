"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Stethoscope } from "lucide-react";
import { cn } from "@/lib/cn";
import { CLIENT_NAV, ADMIN_NAV, type NavItem } from "./nav-config";

type Variant = "client" | "admin";

export function MobileNavDrawer({
  variant,
  open,
  onClose,
}: {
  variant: Variant;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const sections = variant === "admin" ? ADMIN_NAV : CLIENT_NAV;
  const accentClass = variant === "admin" ? "text-signal" : "text-accent";
  const wordmark = variant === "admin" ? "Practice" : "Patient Portal";

  // Lock scroll when open. Close on route change.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Navigation"
        aria-hidden={!open}
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[280px] max-w-[85%] border-r border-border-strong bg-surface-2 shadow-2xl shadow-black/40 transition-transform md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-border/60 px-5">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md bg-surface ring-1 ring-border-strong",
                accentClass
              )}
              aria-hidden
            >
              <Stethoscope className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              {wordmark}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="overflow-y-auto px-3 py-5 space-y-6">
          {sections.map((section) => (
            <div key={section.heading ?? "_"}>
              {section.heading && (
                <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  {section.heading}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <DrawerNavItem
                      item={item}
                      pathname={pathname}
                      onClose={onClose}
                      accentClass={accentClass}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

function DrawerNavItem({
  item,
  pathname,
  onClose,
  accentClass,
}: {
  item: NavItem;
  pathname: string;
  onClose: () => void;
  accentClass: string;
}) {
  const Icon = item.icon;
  const current = normalizePath(pathname);
  const active = isActive(item.href, current);

  if (item.soon) {
    return (
      <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base text-muted/60">
        <Icon className="h-5 w-5 shrink-0" />
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
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-colors",
        active
          ? "bg-foreground/5 text-foreground"
          : "text-muted hover:bg-surface hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
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
