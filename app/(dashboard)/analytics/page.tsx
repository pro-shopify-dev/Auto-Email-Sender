import { MessageSquareReply, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import { Send, XCircle, Clock, MessageSquareReply as ReplyIcon } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { getAnalytics, type Analytics } from "@/services/statsService";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const userId = await requireUserId();

  let analytics: Analytics | null = null;
  let error: string | null = null;
  try {
    analytics = await getAnalytics(userId, 14);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load analytics.";
  }

  return (
    <div>
      <PageHeader title="Analytics" description="How your sending is going." />

      {error && (
        <Card className="mb-6 border-destructive/40">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span>Couldn’t load analytics: {error}</span>
          </CardContent>
        </Card>
      )}

      {analytics && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Sent (14d)"
              value={analytics.totals.totalSent}
              icon={Send}
              tone="success"
            />
            <StatCard
              label="Replies"
              value={analytics.totals.replies}
              hint={
                analytics.totals.sent > 0
                  ? `${(analytics.totals.replyRate * 100).toFixed(1)}% reply rate`
                  : undefined
              }
              icon={ReplyIcon}
              tone={analytics.totals.replies ? "success" : "default"}
            />
            <StatCard
              label="Failed"
              value={analytics.totals.failed}
              icon={XCircle}
              tone={analytics.totals.failed ? "destructive" : "default"}
            />
            <StatCard
              label="In queue"
              value={analytics.totals.queued}
              icon={Clock}
              tone={analytics.totals.queued ? "warning" : "default"}
            />
          </div>

          <AnalyticsCharts data={analytics} />
        </>
      )}

      {/* Reply tracking — active. */}
      <Card className="mt-6 border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-start gap-2 py-4 text-sm sm:flex-row sm:items-center sm:gap-3">
          <MessageSquareReply className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Reply tracking is on</p>
            <p className="text-muted-foreground">
              The worker checks each sent thread for replies every few minutes (headers
              only — it never reads message contents). Replies appear in the counter above
              and as a “Replied” badge in History. If a Gmail wasn’t reconnected after the
              read permission was added, its replies won’t be detected until you reconnect it
              in Settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
