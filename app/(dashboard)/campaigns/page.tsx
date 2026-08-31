"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Square, Users, MailCheck, Clock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { render, contactVariables } from "@/lib/template";
import type { PublicTemplate } from "@/models/template";

interface SendStatus {
  paused: boolean;
  remaining: number;
  sent: number;
  queued: number;
}

/** Sample for the preview — shows the no-name fallback behavior too. */
const SAMPLE = contactVariables({ firstName: "Alex", email: "alex@example.com" });

export default function SendingPage() {
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [templateIds, setTemplateIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<SendStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await apiFetch<SendStatus>("/api/send/status"));
    } catch (err) {
      toast.error("Failed to load status", (err as Error).message);
    }
  }, []);

  useEffect(() => {
    apiFetch<PublicTemplate[]>("/api/templates")
      .then(setTemplates)
      .catch((e) => toast.error("Failed to load templates", (e as Error).message));
    loadStatus();
  }, [loadStatus]);

  // Live refresh while there's anything in flight.
  useEffect(() => {
    const active = (status?.queued ?? 0) > 0;
    if (!active) return;
    const t = setInterval(loadStatus, 3000);
    return () => clearInterval(t);
  }, [status, loadStatus]);

  function toggle(id: string) {
    setTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start() {
    setBusy(true);
    try {
      const res = await apiFetch<SendStatus>("/api/send/start", {
        method: "POST",
        body: JSON.stringify({ templateIds: [...templateIds] }),
      });
      setStatus(res);
      toast.success("Sending started", `${res.remaining} contact(s) left to email.`);
    } catch (err) {
      toast.error("Could not start", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      const res = await apiFetch<SendStatus>("/api/send/stop", { method: "POST" });
      setStatus(res);
      toast.info("Sending stopped", "Press Start to resume where it left off.");
    } catch (err) {
      toast.error("Could not stop", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const running = status ? !status.paused && status.queued > 0 : false;
  const canStart = templateIds.size > 0 && (status?.remaining ?? 0) > 0;
  const chosen = templates.filter((t) => templateIds.has(t.id));

  return (
    <div>
      <PageHeader
        title="Sending"
        description="Start emails everyone not contacted yet. Stop pauses; Start resumes where it left off."
        action={
          <div className="flex items-center gap-2">
            {running ? (
              <Badge variant="success" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Sending
              </Badge>
            ) : status?.paused ? (
              <Badge variant="warning">Stopped</Badge>
            ) : (
              <Badge variant="secondary">Idle</Badge>
            )}
          </div>
        }
      />

      {/* Counters */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          icon={Users}
          value={status?.remaining ?? "—"}
          label="left to email"
          tone="primary"
        />
        <Stat icon={MailCheck} value={status?.sent ?? "—"} label="already sent" tone="green" />
        <Stat icon={Clock} value={status?.queued ?? "—"} label="waiting in queue" tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                Templates
                <Badge variant="secondary">{templateIds.size} selected</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Each contact gets ONE email, using a template picked at random.
              </p>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-y-auto rounded-md border">
                {templates.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">
                    No templates yet — create one first.
                  </p>
                )}
                {templates.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-start gap-3 border-b px-4 py-2 text-sm last:border-0 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={templateIds.has(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                    <span>
                      <span className="font-medium">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.subject}</span>
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            disabled={!canStart || busy}
            onClick={start}
          >
            <Play className="h-4 w-4" />
            {status?.paused && (status?.queued ?? 0) > 0
              ? `Resume — ${status?.remaining ?? 0} left`
              : `Start — email ${status?.remaining ?? 0} contacts`}
          </Button>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            disabled={busy || status?.paused}
            onClick={stop}
          >
            <Square className="h-4 w-4" /> Stop
          </Button>

          {(status?.remaining ?? 0) === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Everyone active has been emailed. Import or add new contacts to send more.
            </p>
          )}
          {templateIds.size === 0 && (status?.remaining ?? 0) > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Select at least one template to start.
            </p>
          )}

          {chosen[0] && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="mb-2 border-b pb-2 text-sm font-medium">
                    {render(chosen[0].subject, SAMPLE)}
                  </p>
                  <div
                    className="prose-sm max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: render(chosen[0].htmlBody, SAMPLE) }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Users;
  value: number | string;
  label: string;
  tone: "primary" | "green" | "amber";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
