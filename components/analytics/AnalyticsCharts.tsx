"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Analytics } from "@/services/statsService";

// Validated palette (dataviz): blue vs red, adjacent CVD ΔE 74.6 — CVD-safe. Status colors
// are the reserved status palette; each mark is also directly labeled, never color-alone.
const SENT = "#2a78d6";
const FAILED = "#e34948";
const STATUS_COLOR: Record<string, string> = {
  sent: "#0ca30c",
  queued: "#fab219",
  processing: "#fab219",
  failed: "#d03b3b",
  cancelled: "#898781",
};

export function AnalyticsCharts({ data }: { data: Analytics }) {
  return (
    <div className="space-y-6">
      <SendActivity daily={data.daily} />
      <div className="grid gap-6 lg:grid-cols-2">
        <StatusBreakdown items={data.statusBreakdown} />
        <GmailUsage items={data.perGmail} />
      </div>
    </div>
  );
}

/* ------------------------------- Line chart -------------------------------- */

function SendActivity({ daily }: { daily: Analytics["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 760;
  const H = 260;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxY = Math.max(1, ...daily.map((d) => Math.max(d.sent, d.failed)));
  const n = daily.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxY) * plotH;

  const line = (key: "sent" | "failed") =>
    daily.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key])}`).join(" ");

  // y gridlines (4 ticks)
  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) =>
    Math.round((maxY / ticks) * i),
  );

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - padL) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const totalSent = daily.reduce((a, d) => a + d.sent, 0);
  const totalFailed = daily.reduce((a, d) => a + d.failed, 0);
  const hd = hover != null ? daily[hover] : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Sending activity · last {n} days</CardTitle>
        <div className="flex items-center gap-4 text-xs">
          <Legend color={SENT} label={`Sent (${totalSent})`} />
          <Legend color={FAILED} label={`Failed (${totalFailed})`} />
        </div>
      </CardHeader>
      <CardContent>
        {totalSent + totalFailed === 0 ? (
          <Empty>No sends yet. Launch a campaign and start the worker.</Empty>
        ) : (
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              role="img"
              aria-label="Daily sent and failed email counts"
            >
              {/* gridlines + y labels */}
              {gridVals.map((v) => (
                <g key={v}>
                  <line
                    x1={padL}
                    x2={W - padR}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth={1}
                  />
                  <text
                    x={padL - 6}
                    y={y(v) + 3}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {v}
                  </text>
                </g>
              ))}

              {/* x labels (first, middle, last) */}
              {[0, Math.floor(n / 2), n - 1].map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {fmtDate(daily[i]!.date)}
                </text>
              ))}

              {/* lines */}
              <path d={line("sent")} fill="none" stroke={SENT} strokeWidth={2} />
              <path d={line("failed")} fill="none" stroke={FAILED} strokeWidth={2} />

              {/* hover crosshair + markers */}
              {hover != null && (
                <>
                  <line
                    x1={x(hover)}
                    x2={x(hover)}
                    y1={padT}
                    y2={padT + plotH}
                    stroke="currentColor"
                    className="text-muted-foreground/50"
                    strokeWidth={1}
                  />
                  <circle cx={x(hover)} cy={y(daily[hover]!.sent)} r={4} fill={SENT} stroke="var(--card, #fff)" strokeWidth={2} />
                  <circle cx={x(hover)} cy={y(daily[hover]!.failed)} r={4} fill={FAILED} stroke="var(--card, #fff)" strokeWidth={2} />
                </>
              )}
            </svg>

            {hd && (
              <div className="pointer-events-none absolute right-2 top-2 rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
                <div className="font-medium">{fmtDate(hd.date, true)}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: SENT }} />
                  Sent: {hd.sent}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: FAILED }} />
                  Failed: {hd.failed}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Status breakdown ----------------------------- */

function StatusBreakdown({ items }: { items: Analytics["statusBreakdown"] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Emails by status</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty>No email jobs yet.</Empty>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.status}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="capitalize">{it.status}</span>
                  <span className="tabular-nums text-muted-foreground">{it.count}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(it.count / max) * 100}%`,
                      background: STATUS_COLOR[it.status] ?? "#898781",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Per-Gmail usage ---------------------------- */

function GmailUsage({ items }: { items: Analytics["perGmail"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Per-Gmail usage</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty>Connect a Gmail account in Settings.</Empty>
        ) : (
          <div className="space-y-3">
            {items.map((g) => {
              const pct =
                g.sendLimit > 0 ? Math.min(100, (g.sentCount / g.sendLimit) * 100) : 0;
              return (
                <div key={g.address}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="truncate">{g.address}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {g.sentCount} / {g.sendLimit === 0 ? "∞" : g.sendLimit}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: pct >= 100 ? "#fab219" : SENT }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------- helpers --------------------------------- */

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>
  );
}

function fmtDate(iso: string, long = false): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, long
    ? { weekday: "short", month: "short", day: "numeric" }
    : { month: "short", day: "numeric" });
}
