import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-based routing (Next.js middleware — kept under the legacy filename
 * `middleware.ts` for compatibility with the Cloudflare OpenNext adapter,
 * which doesn't yet recognise Next 16's new `proxy.ts` convention).
 *
 * Public:    thecodedoctors.com           → marketing site at /
 * Client:    app.thecodedoctors.com       → rewrites to /dashboard/...
 * Staff:     admin.thecodedoctors.com     → rewrites to /admin/...
 *
 * Files keep the /dashboard and /admin path structure on disk; this
 * middleware makes the URL bar clean (e.g. `app.thecodedoctors.com/requests`
 * instead of `app.thecodedoctors.com/dashboard/requests`).
 *
 * Apex visits to /dashboard/* or /admin/* 301 to the right subdomain so
 * any pre-shared link still resolves.
 *
 * Local dev: localhost without a subdomain → no rewrite (use the full
 * /dashboard or /admin path directly). Or edit /etc/hosts to add
 * `127.0.0.1 app.localhost admin.localhost` for the full subdomain feel.
 */

const APEX = "thecodedoctors.com";
const WWW = "www.thecodedoctors.com";
const APP_SUB = "app.thecodedoctors.com";
const ADMIN_SUB = "admin.thecodedoctors.com";

const APP_LOCAL = "app.localhost";
const ADMIN_LOCAL = "admin.localhost";

// Paths the proxy should never rewrite — they live on every host.
function isPassThrough(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/logout" ||
    pathname === "/trial" ||
    pathname.startsWith("/trial/") ||
    pathname === "/start" ||
    pathname.startsWith("/start/") ||
    pathname === "/welcome" ||
    pathname.startsWith("/welcome/") ||
    pathname === "/verify-email" ||
    pathname.startsWith("/verify-email/") ||
    pathname === "/status" ||
    pathname.startsWith("/status/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/.well-known/") ||
    /\.[a-z0-9]{2,5}$/i.test(pathname) // any static asset with extension
  );
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const rawHost = request.headers.get("host") ?? "";
  const host = rawHost.toLowerCase().split(":")[0];

  // Canonicalize www → apex (301). Runs before pass-through so EVERY
  // www request — pages and assets — collapses to the apex host,
  // avoiding duplicate-content SEO split and auth-cookie domain
  // confusion. Path + query are preserved.
  if (host === WWW) {
    url.protocol = "https:";
    url.host = APEX;
    return NextResponse.redirect(url, 301);
  }

  // Forward the post-rewrite pathname to layouts via a header so the
  // 2FA enforcement gate can know whether to skip the redirect for
  // /settings/security (avoiding an infinite loop).
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.set("x-pathname", url.pathname);

  if (isPassThrough(url.pathname)) {
    return NextResponse.next({ request: { headers: forwardHeaders } });
  }

  // Client portal subdomain → rewrite to /dashboard/...
  if (host === APP_SUB || host === APP_LOCAL) {
    if (!url.pathname.startsWith("/dashboard")) {
      const rewritten = url.pathname === "/" ? "/dashboard" : `/dashboard${url.pathname}`;
      forwardHeaders.set("x-pathname", rewritten);
      url.pathname = rewritten;
      return NextResponse.rewrite(url, { request: { headers: forwardHeaders } });
    }
    return NextResponse.next({ request: { headers: forwardHeaders } });
  }

  // Staff portal subdomain → rewrite to /admin/...
  if (host === ADMIN_SUB || host === ADMIN_LOCAL) {
    if (!url.pathname.startsWith("/admin")) {
      const rewritten = url.pathname === "/" ? "/admin" : `/admin${url.pathname}`;
      forwardHeaders.set("x-pathname", rewritten);
      url.pathname = rewritten;
      return NextResponse.rewrite(url, { request: { headers: forwardHeaders } });
    }
    return NextResponse.next({ request: { headers: forwardHeaders } });
  }

  // On the apex domain — redirect any /dashboard or /admin path to the
  // appropriate subdomain so old links + post-login redirects work.
  if (host === APEX) {
    if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) {
      const rest = url.pathname.slice("/dashboard".length) || "/";
      return NextResponse.redirect(
        `https://${APP_SUB}${rest}${url.search}`,
        301
      );
    }
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      const rest = url.pathname.slice("/admin".length) || "/";
      return NextResponse.redirect(
        `https://${ADMIN_SUB}${rest}${url.search}`,
        301
      );
    }
  }

  return NextResponse.next({ request: { headers: forwardHeaders } });
}

export const config = {
  // Run on every request except Next internals; finer-grained passthroughs
  // are handled in `isPassThrough()` above.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
