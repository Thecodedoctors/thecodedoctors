import { Search, X, Archive } from "lucide-react";

/**
 * Search + archive-toggle bar for /requests pages. Submits as a GET form
 * so server components re-render with the new query params — no client
 * hydration needed for the filter itself.
 */
export function RequestsFilterBar({
  q,
  includeArchived,
  archivedCount,
  basePath,
  accent,
  totalShowing,
}: {
  q: string;
  includeArchived: boolean;
  archivedCount: number;
  basePath: string;
  accent: "accent" | "signal";
  totalShowing: number;
}) {
  const accentRing = accent === "accent" ? "focus-within:ring-accent" : "focus-within:ring-signal";
  const accentLink = accent === "accent" ? "text-accent" : "text-signal";
  const togglePath = (() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (!includeArchived) sp.set("archived", "1");
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  })();

  return (
    <div className="mt-6 space-y-3">
      <form
        action={basePath}
        method="get"
        className={`flex items-center gap-2 rounded-xl bg-background px-4 py-2.5 ring-1 ring-inset ring-border ${accentRing}`}
      >
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by title…"
          aria-label="Search requests"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
        {includeArchived && (
          <input type="hidden" name="archived" value="1" />
        )}
        {q && (
          <a
            href={
              includeArchived ? `${basePath}?archived=1` : basePath
            }
            aria-label="Clear search"
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          type="submit"
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#e6e9ee]"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p>
          {q ? (
            <>
              <span className="text-foreground">{totalShowing}</span> match
              {totalShowing === 1 ? "" : "es"} for{" "}
              <span className="font-mono text-foreground">&ldquo;{q}&rdquo;</span>
              {includeArchived ? " (including archived)" : ""}
            </>
          ) : includeArchived ? (
            <>Showing all requests, including archived.</>
          ) : (
            <>Open requests only.</>
          )}
        </p>
        {(archivedCount > 0 || includeArchived) && (
          <a
            href={togglePath}
            className={`inline-flex items-center gap-1.5 ${accentLink} hover:underline`}
          >
            <Archive className="h-3 w-3" />
            {includeArchived
              ? "Hide archived"
              : `Show archived (${archivedCount})`}
          </a>
        )}
      </div>
    </div>
  );
}
