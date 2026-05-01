"use client";

import { useState } from "react";
import { Menu, Search, Bell } from "lucide-react";
import { UserMenu } from "./user-menu";
import { MobileNavDrawer } from "./mobile-drawer";

type Variant = "client" | "admin";

/**
 * Slim top bar for the portal. Hosts (in order):
 *   - Hamburger menu button (mobile only — opens MobileNavDrawer)
 *   - Search placeholder (Phase 3 v2)
 *   - Notifications bell placeholder (Phase 3 v2)
 *   - User menu dropdown
 */
export function AppTopBar({
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <>
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:px-6"
        style={{ viewTransitionName: "site-header" }}
      >
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Search placeholder — Phase 3 v2 */}
          <button
            type="button"
            disabled
            aria-label="Search (coming soon)"
            className="hidden lg:inline-flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-1.5 text-xs text-muted/60 cursor-not-allowed"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <span className="ml-2 rounded bg-muted/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]">
              soon
            </span>
          </button>

          {/* Notifications bell placeholder — Phase 3 v2 */}
          <button
            type="button"
            disabled
            aria-label="Notifications (coming soon)"
            className="grid h-9 w-9 place-items-center rounded-md text-muted/60 cursor-not-allowed"
          >
            <Bell className="h-4 w-4" />
          </button>

          <UserMenu
            variant={variant}
            user={user}
            signOutAction={signOutAction}
          />
        </div>
      </header>

      <MobileNavDrawer
        variant={variant}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
