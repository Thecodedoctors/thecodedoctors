import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/**
 * Wraps every public-facing marketing page with the SiteHeader / SiteFooter
 * shell. Portal and admin routes don't use this layout, so signing in lands
 * the user in a different visual world.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
