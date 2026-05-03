import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SecurityForm } from "@/components/settings/security-form";
import { TotpSection } from "@/components/settings/totp-section";

export const metadata: Metadata = {
  title: "Security · Settings",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ enforce?: string }>;

export default async function ClientSecuritySettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const rows = await db()
    .select({
      passwordHash: users.passwordHash,
      totpEnabled: users.totpEnabled,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const hasPassword = Boolean(rows[0]?.passwordHash);
  const totpEnabled = Boolean(rows[0]?.totpEnabled);
  const email = rows[0]?.email ?? session.user.email ?? "";

  return (
    <SettingsShell
      current="security"
      basePath="/settings"
      accent="accent"
      title="Security"
      description="Password and two-factor authentication."
    >
      <div className="space-y-8">
        {sp.enforce === "1" && !totpEnabled && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-warning">
                  Two-factor is required
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Set up an authenticator app below to continue using your
                  patient portal. It takes about a minute and is the same
                  pattern your bank uses.
                </p>
              </div>
            </div>
          </div>
        )}
        <TotpSection enabled={totpEnabled} emailHint={email} />
        <div className="border-t border-border/60 pt-8">
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Password
          </h2>
          <SecurityForm hasPassword={hasPassword} />
        </div>
      </div>
    </SettingsShell>
  );
}
