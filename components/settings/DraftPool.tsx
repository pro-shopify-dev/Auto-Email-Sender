"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

interface DraftPoolAccount {
  connectionId: string;
  gmailAddress: string;
  pool: number;
}

interface DraftPoolStatus {
  enabled: boolean;
  target: number;
  hasTemplates: boolean;
  reserved: number;
  accounts: DraftPoolAccount[];
}

interface RefillSummary {
  connections: number;
  created: number;
  sent: number;
  released: number;
  deleted: number;
  needsReconnect: string[];
}

/** Shows how many template drafts sit in each Gmail, with a manual top-up. */
export function DraftPool() {
  const [status, setStatus] = useState<DraftPoolStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await apiFetch<DraftPoolStatus>("/api/drafts"));
    } catch {
      // Settings should still render if this fails.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refill() {
    setBusy(true);
    try {
      const s = await apiFetch<RefillSummary>("/api/drafts/refill", { method: "POST" });
      if (s.needsReconnect.length > 0) {
        toast.error(
          "Reconnect needed",
          `${s.needsReconnect.join(", ")} — reconnect to grant the draft permission.`,
        );
      } else {
        const bits = [`${s.created} created`];
        if (s.sent) bits.push(`${s.sent} hand-sent recorded`);
        if (s.released) bits.push(`${s.released} released`);
        toast.success("Drafts topped up", `${bits.join(" · ")} across ${s.connections} account(s).`);
      }
      await load();
    } catch (err) {
      toast.error("Could not refill drafts", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Template drafts
        </CardTitle>
        <Button size="sm" variant="outline" disabled={busy} onClick={refill}>
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Refilling…" : "Refill now"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Each connected Gmail keeps{" "}
          <span className="font-medium text-foreground">{status?.target ?? 300}</span>{" "}
          ready-to-send drafts, each addressed to a real contact and rendered from a template.
          Send one by hand and it is logged to History, the contact is never emailed again,
          and replies are tracked. Delete one and that contact goes back in the queue.
        </p>
        {status && status.reserved > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{status.reserved}</span> contacts are
            currently held by waiting drafts (skipped by the auto-sender).
          </p>
        )}

        {status && !status.enabled && (
          <p className="text-sm text-amber-600">
            Disabled via GMAIL_DRAFT_POOL_ENABLED in .env.
          </p>
        )}
        {status && !status.hasTemplates && (
          <p className="flex items-center gap-1.5 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" /> Add at least one template — drafts are built
            from them.
          </p>
        )}

        {status?.accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">No Gmail connected yet.</p>
        )}

        <div className="space-y-2">
          {status?.accounts.map((a) => {
            const full = a.pool >= status.target;
            return (
              <div
                key={a.connectionId}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{a.gmailAddress}</span>
                <Badge variant={full ? "success" : "warning"} className="gap-1">
                  {full && <CheckCircle2 className="h-3 w-3" />}
                  {a.pool} / {status.target} drafts
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
