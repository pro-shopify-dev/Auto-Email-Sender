import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GmailConnections } from "@/components/settings/GmailConnections";
import { ResetSending } from "@/components/settings/ResetSending";
import { DraftPool } from "@/components/settings/DraftPool";
import { requireUserId, getSessionUser } from "@/lib/session";
import { getConnections } from "@/services/gmailService";
import type { PublicGmailConnection } from "@/models/gmailConnection";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await getSessionUser();

  let connections: PublicGmailConnection[] = [];
  try {
    connections = await getConnections(userId);
  } catch {
    connections = [];
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Manage your account and Gmail connection." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {user?.name}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span> {user?.email}
            </p>
          </CardContent>
        </Card>

        <Suspense fallback={null}>
          <GmailConnections initial={connections} />
        </Suspense>

        <DraftPool />

        <Card>
          <CardHeader>
            <CardTitle>How sending works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Emails are sent by a background worker that rotates across your connected Gmail
            accounts, respecting each account’s pace and limit. Start it with{" "}
            <code>npm run worker</code>. Nothing sends in a single request.
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Start fresh</p>
              Mark every contact as not-yet-emailed, delete all send history, and reset each
              Gmail’s counter. Contacts, templates, and connections are kept.
            </div>
            <ResetSending />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
