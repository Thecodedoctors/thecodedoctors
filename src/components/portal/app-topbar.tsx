"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { UserMenu } from "./user-menu";
import { MobileNavDrawer } from "./mobile-drawer";
import { PortalSearch } from "./search-bar";

type Variant = "client" | "admin";

/**
 * Slim top bar for the portal. Hosts (in order):
 *   - Hamburger menu button (mobile only — opens MobileNavDrawer)
 *   - Cross-resource search (desktop ≥ lg; ⌘K / Ctrl+K to focus)
 *   - Notifications bell (passed in as a server-rendered slot so it can
 *     query the DB for unread count)
 *   - User menu dropdown
 */
export function AppTopBar({
  variant,
  user,
  signOutAction,
  bell,
}: {
  variant: Variant;
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string;
  };
  signOutAction: () => Promise<void>;
  bell?: ReactNode;
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
          <PortalSearch />

          {/* Notifications — server-rendered so it can fetch unread count */}
          {bell}

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
