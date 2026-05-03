import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/ui/section";
import { getClientForStaff } from "@/server/clients";
import { NewCredentialForm } from "@/components/admin/new-credential-form";

export const metadata: Metadata = {
  title: "New credential request · Practice",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ clientId?: string }>;

export default async function NewCredentialPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const clientId = sp.clientId;
  if (!clientId) {
    return (
      <Section size="md" reveal={false}>
        <div className="mx-auto max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
            Credentials
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Pick a patient first
          </h1>
          <p className="mt-2 text-sm text-muted">
            Open a patient&apos;s detail page and use the &ldquo;Request
            credentials&rdquo; button there — that pre-fills the patient
            for you.
          </p>
          <Link
            href="/clients"
            className="mt-4 inline-block rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
          >
            Patients list
          </Link>
        </div>
      </Section>
    );
  }

  const data = await getClientForStaff(clientId);
  if (!data) notFound();

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/clients/${clientId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {data.client.name}
        </Link>

        <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-signal">
          {data.client.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Request credentials
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pick a template (or build your own), set what the patient should
          fill, and send. We email them with a link the moment you hit
          create.
        </p>

        <div className="mt-8">
          <NewCredentialForm clientId={clientId} />
        </div>
      </div>
    </Section>
  );
}
