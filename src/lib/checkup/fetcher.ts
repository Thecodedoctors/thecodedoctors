import { CheckupValidationError, validateAndResolve } from "./url-validation";

const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_000_000; // 1MB cap on body
const MAX_REDIRECTS = 3;
const USER_AGENT =
  "TheCodeDoctors-Checkup/0.1 (+https://thecodedoctors.com/checkup)";

export type FetchedPage = {
  initialUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  redirectChain: Array<{ from: string; to: string; status: number }>;
  bodyText: string;
  bodyTruncated: boolean;
  totalDurationMs: number;
  /** Was the *initial* request HTTPS? */
  initialWasHttps: boolean;
  /** Was an HTTP→HTTPS upgrade observed in the redirect chain? */
  upgradedToHttps: boolean;
};

/**
 * Fetch the page with manual redirect handling so we can record the chain
 * and re-validate hop-by-hop later if needed. Caps body size and total time.
 */
export async function fetchPage(initialUrl: URL): Promise<FetchedPage> {
  const start = Date.now();
  const redirectChain: FetchedPage["redirectChain"] = [];
  let current = initialUrl.toString();
  let response: Response | null = null;
  let upgradedToHttps = false;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // SSRF guard: re-validate (DNS-resolve + reject private/loopback/
    // link-local/metadata) the EXACT url we're about to fetch, on
    // every hop — not just the initial url and not only post-hoc on
    // the final url. Without this, a public url that 302s to
    // http://169.254.169.254/ or http://10.x/ would be fetched before
    // any check ran. validateAndResolve throws CheckupValidationError
    // (private/dns/scheme) which the route maps to a clean 4xx.
    await validateAndResolve(current);

    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new CheckupValidationError(
        "fetch-failed",
        err instanceof Error && err.name === "TimeoutError"
          ? "The site took too long to respond."
          : "We couldn't reach that URL."
      );
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        response = res;
        break;
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new CheckupValidationError(
          "fetch-failed",
          "The site returned an invalid redirect."
        );
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new CheckupValidationError(
          "fetch-failed",
          "The site redirected to a non-HTTP URL."
        );
      }
      redirectChain.push({
        from: current,
        to: next.toString(),
        status: res.status,
      });
      // Detect HTTP → HTTPS upgrade
      if (current.startsWith("http://") && next.protocol === "https:") {
        upgradedToHttps = true;
      }
      current = next.toString();
      // Drain the body so connections can be reused
      try {
        await res.body?.cancel();
      } catch {
        /* noop */
      }
      continue;
    }

    response = res;
    break;
  }

  if (!response) {
    throw new CheckupValidationError(
      "too-many-redirects",
      "The site redirected too many times."
    );
  }

  // Read body up to MAX_BYTES.
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        truncated = true;
        try {
          await reader.cancel();
        } catch {
          /* noop */
        }
        break;
      }
      chunks.push(value);
    }
  }

  let bodyText = "";
  if (chunks.length > 0) {
    const combined = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
    let offset = 0;
    for (const chunk of chunks) {
      const remaining = combined.byteLength - offset;
      const slice = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
      combined.set(slice, offset);
      offset += slice.byteLength;
      if (offset >= combined.byteLength) break;
    }
    bodyText = new TextDecoder("utf-8", { fatal: false }).decode(combined);
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    initialUrl: initialUrl.toString(),
    finalUrl: current,
    status: response.status,
    headers,
    redirectChain,
    bodyText,
    bodyTruncated: truncated,
    totalDurationMs: Date.now() - start,
    initialWasHttps: initialUrl.protocol === "https:",
    upgradedToHttps,
  };
}
