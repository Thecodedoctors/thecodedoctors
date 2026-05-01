import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { listRequestsForCurrentUser } from "@/server/requests";
import { StatusPill, PriorityPill, TypeLabel } from "@/components/status-pill";

export const metadata: Metadata = {
  title: "Requests",
  robots: { index: false, follow: false },
};

export default async function RequestsListPage() {
  const requests = await listRequestsForCurrentUser();

  return (
    <Section size="md" reveal={false}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Your requests
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            {requests.length === 0
              ? "No requests yet"
              : requests.length === 1
                ? "1 request"
                : `${requests.length} requests`}
          </h1>
        </div>
        <Button href="/dashboard/requests/new" variant="primary" size="md">
          <Plus className="h-4 w-4" />
          New request
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Empty
          </p>
          <p className="mt-3 text-base text-foreground">
            Submit your first request to begin treatment.
          </p>
          <div className="mt-6">
            <Button
              href="/dashboard/requests/new"
              variant="primary"
              size="md"
            >
              Submit a request
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/requests/${r.id}`}
                className="block px-6 py-5 transition-colors hover:bg-surface/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-foreground">
                      {r.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <TypeLabel type={r.type} />
                      <span className="text-muted">·</span>
                      <PriorityPill priority={r.priority} />
                      <span className="text-muted">·</span>
                      <span className="font-mono text-xs text-muted">
                        Updated{" "}
                        {new Date(r.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <StatusPill status={r.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
