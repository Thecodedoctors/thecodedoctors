"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  MOBILE_BOTTOM_NAV_CLIENT,
  MOBILE_BOTTOM_NAV_ADMIN,
} from "./nav-config";

type Variant = "client" | "admin";

export function BottomNav({ variant }: { variant: Variant }) {
  const pathname = usePathname();
  const items =
    variant === "admin" ? MOBILE_BOTTOM_NAV_ADMIN : MOBILE_BOTTOM_NAV_CLIENT;
  const accentClass = variant === "admin" ? "text-signal" : "text-accent";

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-30 grid grid-flow-col auto-cols-fr border-t border-border/60 bg-background/90 px-2 backdrop-blur-xl md:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, normalizePath(pathname));
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted/60"
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-2 text-[10px] transition-colors",
              active ? "text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", active && accentClass)} />
            {item.label}
          </Link>
        );
      })}
    </nav>
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
