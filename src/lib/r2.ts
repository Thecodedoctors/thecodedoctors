import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Minimal R2 surface — only the methods we use, kept here so we don't
 * have to depend on `@cloudflare/workers-types`. At runtime the binding
 * provides the real R2Bucket; TypeScript just needs enough shape.
 */
export type UploadsBucket = {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: {
      httpMetadata?: { contentType?: string; contentDisposition?: string };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream<Uint8Array>;
    size: number;
  } | null>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<{ size: number } | null>;
};

/**
 * Returns the R2 UPLOADS binding when running on Cloudflare Workers.
 * Returns null in `next dev` (no Worker bindings) so callers can
 * surface a friendly error instead of crashing.
 */
export async function getUploadsBucket(): Promise<UploadsBucket | null> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    // Cast through unknown — the ambient CloudflareEnv from
    // @opennextjs/cloudflare doesn't declare our app-specific UPLOADS
    // binding, so we narrow at the call site.
    const env = ctx?.env as unknown as {
      UPLOADS?: UploadsBucket;
    } | undefined;
    return env?.UPLOADS ?? null;
  } catch {
    return null;
  }
}
