import Link from "next/link";
import { site } from "@/lib/site";
import { Stethoscope } from "lucide-react";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 bg-surface/30">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span
                className="grid h-8 w-8 place-items-center rounded-md bg-surface text-accent ring-1 ring-border-strong"
                aria-hidden
              >
                <Stethoscope className="h-4 w-4" />
              </span>
              <span className="font-semibold tracking-tight">{site.name}</span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
              {site.description}
            </p>
            <p className="mt-5 text-xs text-muted">
              Found a security issue?{" "}
              <Link
                href="/.well-known/security.txt"
                className="underline decoration-border-strong underline-offset-4 hover:text-foreground hover:decoration-accent"
              >
                See our security.txt
              </Link>
              .
            </p>
          </div>

          <FooterCol title="Practice" links={site.footerNav.practice} />
          <FooterCol title="Care" links={site.footerNav.care} />
          <FooterCol title="Legal" links={site.footerNav.legal} />
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted md:flex-row md:items-center">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <p className="font-mono uppercase tracking-[0.18em]">
            <span className="text-success">●</span> All systems healthy
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div className="md:col-span-2">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-muted-strong transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
