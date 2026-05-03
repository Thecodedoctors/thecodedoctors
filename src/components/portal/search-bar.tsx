"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ListChecks,
  Users,
  BookOpen,
} from "lucide-react";
import { searchPortal, type SearchHit, type SearchResults } from "@/server/search";

const DEBOUNCE_MS = 220;
const EMPTY: SearchResults = {
  requests: [],
  patients: [],
  knowledge: [],
  total: 0,
};

/**
 * Cross-resource search for the patient + practice portals. Server
 * action does the actual lookup (`searchPortal` in `src/server/search`)
 * — this component is just the input + dropdown + keyboard wiring.
 *
 * Behaviour:
 *   - ⌘K / Ctrl+K from anywhere focuses the input.
 *   - Typing triggers a debounced search after 2+ characters.
 *   - ↑/↓ moves selection, Enter navigates, Esc closes.
 *   - Click outside closes; clicking a result navigates and resets.
 */
export function PortalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();

  // Flatten in render order for keyboard navigation.
  const flat: SearchHit[] = useMemo(() => {
    return [...results.requests, ...results.patients, ...results.knowledge];
  }, [results]);

  // Debounced server lookup.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        try {
          const r = await searchPortal(trimmed);
          setResults(r);
          setActive(0);
        } catch {
          setResults(EMPTY);
        }
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // ⌘K / Ctrl+K to focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function commit(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    router.push(hit.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) commit(hit);
    }
  }

  const showDropdown = open && query.trim().length >= 2;
  const isMacUA =
    typeof navigator !== "undefined" &&
    /(Mac|iPhone|iPad|iPod)/.test(navigator.platform);

  return (
    <div ref={wrapRef} className="relative hidden lg:block">
      <div
        className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-1.5 transition-colors focus-within:border-accent/60 focus-within:bg-surface/70"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search…"
          aria-label="Search"
          className="w-48 bg-transparent text-xs text-foreground outline-none placeholder:text-muted xl:w-64"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults(EMPTY);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="grid h-5 w-5 place-items-center rounded text-muted hover:bg-surface hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <span className="font-mono text-[10px] text-muted/70">
            {isMacUA ? "⌘K" : "Ctrl+K"}
          </span>
        )}
      </div>

      {showDropdown && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-[28rem] max-w-[80vw] origin-top-right overflow-hidden rounded-xl border border-border-strong bg-surface-2 shadow-2xl shadow-black/40"
        >
          {pending && results.total === 0 ? (
            <p className="p-5 text-center font-mono text-xs text-muted">
              Searching…
            </p>
          ) : results.total === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              Nothing matches{" "}
              <span className="font-mono text-foreground">
                &ldquo;{query.trim()}&rdquo;
              </span>
              .
            </p>
          ) : (
            <ResultGroups
              results={results}
              flat={flat}
              active={active}
              onCommit={commit}
              setActive={setActive}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function ResultGroups({
  results,
  flat,
  active,
  onCommit,
  setActive,
}: {
  results: SearchResults;
  flat: SearchHit[];
  active: number;
  onCommit: (hit: SearchHit) => void;
  setActive: (i: number) => void;
}) {
  let i = 0;
  return (
    <div className="max-h-[28rem] overflow-y-auto">
      {results.requests.length > 0 && (
        <Group title="Requests" icon={ListChecks}>
          {results.requests.map((hit) => {
            const idx = i++;
            return (
              <Row
                key={`r-${hit.kind === "request" ? hit.id : "x"}`}
                hit={hit}
                isActive={flat[active] === hit}
                onMouseEnter={() => setActive(idx)}
                onClick={() => onCommit(hit)}
              />
            );
          })}
        </Group>
      )}
      {results.patients.length > 0 && (
        <Group title="Patients" icon={Users}>
          {results.patients.map((hit) => {
            const idx = i++;
            return (
              <Row
                key={`p-${hit.kind === "patient" ? hit.id : "x"}`}
                hit={hit}
                isActive={flat[active] === hit}
                onMouseEnter={() => setActive(idx)}
                onClick={() => onCommit(hit)}
              />
            );
          })}
        </Group>
      )}
      {results.knowledge.length > 0 && (
        <Group title="Knowledge" icon={BookOpen}>
          {results.knowledge.map((hit) => {
            const idx = i++;
            return (
              <Row
                key={`k-${hit.kind === "knowledge" ? hit.slug : "x"}`}
                hit={hit}
                isActive={flat[active] === hit}
                onMouseEnter={() => setActive(idx)}
                onClick={() => onCommit(hit)}
              />
            );
          })}
        </Group>
      )}
    </div>
  );
}

function Group({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 border-b border-border/60 bg-surface/30 px-4 py-2">
        <Icon className="h-3 w-3 text-muted" />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {title}
        </p>
      </div>
      <ul>{children}</ul>
    </section>
  );
}

function Row({
  hit,
  isActive,
  onMouseEnter,
  onClick,
}: {
  hit: SearchHit;
  isActive: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
        className={
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors " +
          (isActive
            ? "bg-accent-soft/30 text-foreground"
            : "text-foreground hover:bg-surface")
        }
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{hit.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{hit.subtitle}</p>
        </div>
      </button>
    </li>
  );
}
