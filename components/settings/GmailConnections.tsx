"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Mail,
  CheckCircle2,
  Link2Off,
  Plus,
  RotateCcw,
  Gauge,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import type {
  PublicGmailConnection,
  GmailConnectionStatus,
} from "@/models/gmailConnection";

const statusMeta: Record<
  GmailConnectionStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" }
> = {
  connected: { label: "Sending", variant: "success" },
  limit_reached: { label: "Limit reached", variant: "warning" },
  error: { label: "Needs reconnect", variant: "destructive" },
  revoked: { label: "Needs reconnect", variant: "destructive" },
};

export function GmailConnections({
  initial,
}: {
  initial: PublicGmailConnection[];
}) {
  const [connections, setConnections] = useState(initial);
  const params = useSearchParams();
  const router = useRouter();

  // Surface the OAuth callback result (?gmail=connected|denied|error) and refresh the list.
  useEffect(() => {
    const state = params.get("gmail");
    if (!state) return;
    if (state === "connected") {
      toast.success("Gmail connected");
      reload();
    } else if (state === "denied") toast.error("Connection cancelled");
    else if (state === "error")
      toast.error("Could not connect Gmail", params.get("reason") ?? undefined);
    router.replace("/settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function reload() {
    try {
      setConnections(await apiFetch<PublicGmailConnection[]>("/api/gmail"));
    } catch (err) {
      toast.error("Failed to load accounts", (err as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Sending Gmail accounts
        </CardTitle>
        {/* Full navigation (not fetch) so the browser follows Google's redirect. */}
        <a href="/api/gmail/connect">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Connect Gmail
          </Button>
        </a>
      </CardHeader>
      <CardContent className="space-y-4">
        {connections.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No Gmail connected yet. Connect one or more accounts — the worker rotates
            through them, sending at each account’s pace up to its limit. Your password is
            never stored.
          </div>
        )}
        {connections.map((c) => (
          <ConnectionRow key={c.id} conn={c} onChanged={reload} />
        ))}
        {connections.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Emails rotate across these accounts one-by-one. Each sends at its own pace and
            stops at its own limit. Total you can send = the sum of all limits.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectionRow({
  conn,
  onChanged,
}: {
  conn: PublicGmailConnection;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    sendLimit: conn.sendLimit,
    throttlePerWindow: conn.throttlePerWindow,
    throttleWindowSeconds: conn.throttleWindowSeconds,
  });

  const meta = statusMeta[conn.status];
  const pct =
    conn.sendLimit > 0 ? Math.min(100, Math.round((conn.sentCount / conn.sendLimit) * 100)) : 0;

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/gmail/${conn.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(msg);
      onChanged();
    } catch (err) {
      toast.error("Could not update", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await apiFetch(`/api/gmail/${conn.id}/reset`, { method: "POST" });
      toast.success("Counter reset");
      onChanged();
    } catch (err) {
      toast.error("Could not reset", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Disconnect ${conn.gmailAddress}? Queued sends from it will wait.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/gmail/${conn.id}`, { method: "DELETE" });
      toast.success("Disconnected");
      onChanged();
    } catch (err) {
      toast.error("Could not disconnect", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{conn.gmailAddress}</span>
          <Badge variant={meta.variant} className="gap-1">
            {conn.status === "connected" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Ban className="h-3 w-3" />
            )}
            {meta.label}
          </Badge>
          {!conn.enabled && <Badge variant="secondary">Paused</Badge>}
          {(conn.status === "revoked" || conn.status === "error") && (
            <a href="/api/gmail/connect">
              <Button size="sm" variant="outline" className="h-7">
                <RotateCcw className="h-3.5 w-3.5" /> Reconnect
              </Button>
            </a>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => patch({ enabled: !conn.enabled }, conn.enabled ? "Paused" : "Resumed")}
          >
            {conn.enabled ? "Pause" : "Resume"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
            <Link2Off className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Usage + pacing summary */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex-1 min-w-[180px]">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>
              {conn.sentCount} / {conn.sendLimit === 0 ? "∞" : conn.sendLimit} sent
            </span>
            {conn.sendLimit > 0 && <span>{pct}%</span>}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${pct >= 100 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Gauge className="h-4 w-4" />
          {conn.throttlePerWindow} per {conn.throttleWindowSeconds}s
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
          {editing ? "Close" : "Edit limits"}
        </Button>
      </div>

      {editing && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`limit-${conn.id}`}>Send limit (0 = ∞)</Label>
            <Input
              id={`limit-${conn.id}`}
              type="number"
              min={0}
              value={form.sendLimit}
              onChange={(e) => setForm((f) => ({ ...f, sendLimit: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`per-${conn.id}`}>Emails per window</Label>
            <Input
              id={`per-${conn.id}`}
              type="number"
              min={1}
              value={form.throttlePerWindow}
              onChange={(e) =>
                setForm((f) => ({ ...f, throttlePerWindow: Number(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`win-${conn.id}`}>Window (seconds)</Label>
            <Input
              id={`win-${conn.id}`}
              type="number"
              min={1}
              value={form.throttleWindowSeconds}
              onChange={(e) =>
                setForm((f) => ({ ...f, throttleWindowSeconds: Number(e.target.value) }))
              }
            />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                patch(form, "Limits updated").then(() => setEditing(false))
              }
            >
              Save limits
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
