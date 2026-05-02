import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Minimal R2Bucket type — pulled in inline so we don't have to ship
 * `@cloudflare/workers-types` in dependencies just for these few methods.
 */
type R2PutOptions = {
  httpMetadata?: { contentType?: string; contentDisposition?: string };
  customMetadata?: Record<string, string>;
};

type R2ObjectBody = {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string; contentDisposition?: string };
  size: number;
};

export type R2Bucket = {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: R2PutOptions
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<{ size: number } | null>;
};

/**
 * Returns the R2 UPLOADS binding when running on Cloudflare Workers.
 * Returns null in `next dev` (no Worker bindings) so callers can return
 * a friendly error instead of crashing.
 */
export async function getUploadsBucket(): Promise<R2Bucket | null> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx?.env as { UPLOADS?: R2Bucket } | undefined;
    return env?.UPLOADS ?? null;
  } catch {
    return null;
  }
}
