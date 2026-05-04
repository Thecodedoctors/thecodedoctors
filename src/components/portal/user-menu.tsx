"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, Settings, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "client" | "admin";

export function UserMenu({
  variant,
  user,
  signOutAction,
}: {
  variant: Variant;
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string;
  };
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();
  const displayName = user.name ?? user.email?.split("@")[0] ?? "Account";
  const accentRing =
    variant === "admin"
      ? "ring-signal/30 bg-signal/10 text-signal"
      : "ring-accent/30 bg-accent-soft text-accent";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-surface",
          open && "bg-surface"
        )}
      >
        <span
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full ring-1 ring-inset font-mono text-xs",
            accentRing
          )}
        >
          {initial}
        </span>
        <span className="hidden sm:inline text-sm text-muted">{displayName}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-xl border border-border-strong bg-surface-2 shadow-xl shadow-black/40"
        >
          <div className="px-4 pt-4 pb-3 border-b border-border/60">
            <p className="text-sm text-foreground">{displayName}</p>
            {user.email && user.email !== displayName && (
              <p className="font-mono text-xs text-muted truncate">
                {user.email}
              </p>
            )}
            {user.role && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {user.role.replace("_", " ")}
              </p>
            )}
          </div>
          <ul className="py-2 text-sm">
            <li>
              <a
                href="/settings"
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2 text-muted hover:text-foreground hover:bg-surface"
              >
                <Settings className="h-4 w-4" />
                Settings
              </a>
            </li>
            <li>
              <a
                href="/knowledge"
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2 text-muted hover:text-foreground hover:bg-surface"
              >
                <HelpCircle className="h-4 w-4" />
                Help
              </a>
            </li>
          </ul>
          <form action={signOutAction} className="border-t border-border/60">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-strong transition-colors hover:bg-surface hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
