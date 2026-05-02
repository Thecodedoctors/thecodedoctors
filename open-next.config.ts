import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext config for the Cloudflare Worker adapter.
 *
 * We rely entirely on the defaults — there's no custom incremental cache,
 * queue, or KV layer wired up yet. If we ever add R2-backed ISR cache or
 * Queues for after-response work, plumb them in here.
 */
export default defineCloudflareConfig({});
