import Link from "next/link";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Stethoscope } from "lucide-react";

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 site-header"
      style={{ viewTransitionName: "site-header" }}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-foreground"
          aria-label={`${site.name} home`}
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-md bg-surface text-accent ring-1 ring-border-strong transition-colors group-hover:ring-accent"
            aria-hidden
          >
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">{site.name}</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm text-muted"
        >
          {site.nav.slice(0, 3).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <Link
            href="/checkup"
            className="hidden sm:inline-flex text-sm text-muted transition-colors hover:text-foreground"
          >
            Free Checkup
          </Link>
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm text-muted transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button href="/book" size="sm">
            Book a Doctor
          </Button>
        </div>
      </div>
    </header>
  );
}
