import Link from "next/link";
import {
  Mail,
  Users,
  Megaphone,
  Send,
  AlertTriangle,
  Clock,
  FileText,
  PlugZap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUserId } from "@/lib/session";
import { getDashboardStats, type DashboardStats } from "@/services/statsService";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await requireUserId();

  let stats: DashboardStats | null = null;
  let error: string | null = null;
  try {
    stats = await getDashboardStats(userId);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load dashboard data.";
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="An overview of your account." />

      {error && (
        <Card className="mb-6 border-destructive/40">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium">Couldn’t reach the database.</p>
              <p className="text-muted-foreground">
                Set <code>MONGODB_URI</code> in <code>.env</code> and restart. ({error})
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!stats?.gmailConnected && !error && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <PlugZap className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">Connect your Gmail to start sending.</p>
                <p className="text-muted-foreground">
                  We use OAuth — your password is never stored.
                </p>
              </div>
            </div>
            <Link href="/settings">
              <Button size="sm">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Connected Gmail"
          value={
            stats?.gmailConnected
              ? `${stats.gmailCount} connected`
              : "Not connected"
          }
          hint={
            stats && stats.gmailCount > 1
              ? `${stats.gmailAddress} +${stats.gmailCount - 1} more`
              : (stats?.gmailAddress ?? undefined)
          }
          icon={Mail}
          tone={stats?.gmailConnected ? "success" : "warning"}
        />
        <StatCard
          label="Contacts"
          value={stats?.contacts ?? 0}
          hint={stats ? `${stats.emailed} emailed` : undefined}
          icon={Users}
        />
        <StatCard
          label="Left to email"
          value={stats?.remaining ?? 0}
          hint="never contacted"
          icon={Megaphone}
          tone={stats?.remaining ? "warning" : "default"}
        />
        <StatCard
          label="Sent today"
          value={stats?.sentToday ?? 0}
          icon={Send}
          tone="success"
        />
        <StatCard
          label="Failed"
          value={stats?.failed ?? 0}
          icon={AlertTriangle}
          tone={stats?.failed ? "destructive" : "default"}
        />
        <StatCard
          label="Queue"
          value={stats?.queued ?? 0}
          hint="waiting to send"
          icon={Clock}
          tone={stats?.queued ? "warning" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink href="/compose" icon={Send} title="Compose" desc="Send a one-off email" />
        <QuickLink href="/contacts" icon={Users} title="Contacts" desc="Manage recipients" />
        <QuickLink href="/templates" icon={FileText} title="Templates" desc="Reusable emails" />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: typeof Mail;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex items-center gap-3 p-5">
          <Icon className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
