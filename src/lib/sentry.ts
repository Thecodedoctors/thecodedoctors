/**
 * Minimal, Cloudflare-Workers-safe Sentry capture — no SDK.
 *
 * The official `@sentry/nextjs` SDK assumes a Node/Vercel server and
 * is not safe to bolt onto the `@opennextjs/cloudflare` Worker
 * runtime (it can break the build). This instead builds a Sentry
 * `store` event by hand and POSTs it with `fetch`, which works
 * identically in the browser and on Workers.
 *
 * It reads the PUBLIC DSN from `NEXT_PUBLIC_SENTRY_DSN` (inlined into
 * both client and server bundles at build time). If the DSN isn't
 * set it is a silent no-op, so this is safe to ship before the
 * Sentry project exists. It never throws — telemetry must not break
 * the app.
 *
 * Captures the real, user-facing crashes (everything that reaches an
 * error boundary — client renders AND server-component throws, since
 * the boundaries are client components whose effect runs in the
 * browser). Upgrade to the full SDK later if breadcrumbs / source
 * maps are wanted.
 */
export function captureException(
  error: unknown,
  context?: {
    surface?: string;
    digest?: string;
    extra?: Record<string, unknown>;
  }
): void {
  try {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    // DSN: https://<publicKey>@<host>/<projectId>
    const m = /^https:\/\/([^@]+)@([^/]+)\/(.+)$/.exec(dsn);
    if (!m) return;
    const [, publicKey, host, projectId] = m;

    const err =
      error instanceof Error ? error : new Error(String(error));

    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "error",
      environment: process.env.NODE_ENV ?? "production",
      logger: context?.surface ?? "app",
      exception: {
        values: [{ type: err.name, value: err.message }],
      },
      tags: {
        surface: context?.surface,
        digest: context?.digest,
      },
      extra: {
        stack: err.stack,
        ...context?.extra,
      },
    };

    void fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=tcd-lite/1.0`,
      },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      /* swallow — never surface telemetry failures */
    });
  } catch {
    /* never let capture throw into the app */
  }
}
