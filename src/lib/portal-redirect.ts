/**
 * Resolve a `/dashboard...` or `/admin...` marker path to the absolute
 * URL for that surface in production.
 *
 * Why: server `redirect()` of a relative path stays on the current host.
 * In prod we run three subdomains (apex, app, admin), so a bare
 * `redirect("/admin")` from a page rendered on `app.thecodedoctors.com`
 * lands the browser at `app.thecodedoctors.com/admin`, which the app-
 * subdomain middleware rewrites to `/dashboard/admin` (which doesn't
 * exist) → 404. Same in the other direction.
 *
 * In dev / local the marker paths are kept relative so localhost works
 * without /etc/hosts subdomain wiring.
 */

const isProd = process.env.NODE_ENV === "production";

export function resolvePortalRedirect(path: string): string {
  if (!isProd) return path;
  if (path === "/admin" || path.startsWith("/admin/")) {
    const rest = path.slice("/admin".length) || "/";
    return `https://admin.thecodedoctors.com${rest}`;
  }
  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    const rest = path.slice("/dashboard".length) || "/";
    return `https://app.thecodedoctors.com${rest}`;
  }
  return path;
}

export const ADMIN_HOME = isProd ? "https://admin.thecodedoctors.com/" : "/admin";
export const APP_HOME = isProd ? "https://app.thecodedoctors.com/" : "/dashboard";

/**
 * Resolve a `/dashboard/...` (or `/admin/...`) marker path to the URL
 * that should appear in the BROWSER bar after a server-action redirect.
 *
 * The `/dashboard/...` form is what the on-disk routes look like, but on
 * the `app.thecodedoctors.com` subdomain the public-facing URL is
 * `/billing` (etc.) — the middleware rewrites internally. If a server
 * action does `redirect("/dashboard/billing?...")` the URL bar ends up
 * at `app.thecodedoctors.com/dashboard/billing`, which works but looks
 * like a routing leak. Using this helper, server actions redirect to
 * the absolute clean URL on the right subdomain instead.
 *
 * In dev (no subdomain wiring) we keep the relative `/dashboard/...`
 * path so localhost still works.
 */
export function portalActionRedirect(path: string): string {
  if (!isProd) return path;
  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    const cleaned = path.slice("/dashboard".length) || "/";
    return `https://app.thecodedoctors.com${cleaned}`;
  }
  if (path === "/admin" || path.startsWith("/admin/")) {
    const cleaned = path.slice("/admin".length) || "/";
    return `https://admin.thecodedoctors.com${cleaned}`;
  }
  return path;
}
