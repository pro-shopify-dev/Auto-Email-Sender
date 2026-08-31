import * as contactRepo from "@/repositories/contactRepo";
import * as templateRepo from "@/repositories/templateRepo";
import * as emailJobRepo from "@/repositories/emailJobRepo";
import { getConnections } from "@/services/gmailService";

export interface DashboardStats {
  gmailConnected: boolean;
  gmailCount: number;
  gmailAddress: string | null;
  contacts: number;
  templates: number;
  /** Contacts still to email (never sent to). */
  remaining: number;
  /** Contacts already emailed. */
  emailed: number;
  sentToday: number;
  failed: number;
  queued: number;
}

/** Aggregate the numbers shown on the dashboard cards. */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [
    connections,
    contacts,
    templates,
    remaining,
    emailed,
    sentToday,
    failed,
    queued,
  ] = await Promise.all([
    getConnections(userId),
    contactRepo.countForUser(userId),
    templateRepo.countForUser(userId),
    contactRepo.countSendable(userId),
    contactRepo.countEmailed(userId),
    emailJobRepo.countSentToday(userId),
    emailJobRepo.countByStatus(userId, "failed"),
    emailJobRepo.countByStatus(userId, "queued"),
  ]);

  const connected = connections.filter((c) => c.status === "connected");

  return {
    gmailConnected: connected.length > 0,
    gmailCount: connected.length,
    gmailAddress: connected[0]?.gmailAddress ?? null,
    contacts,
    templates,
    remaining,
    emailed,
    sentToday,
    failed,
    queued,
  };
}

export interface Analytics {
  daily: { date: string; sent: number; failed: number }[];
  statusBreakdown: { status: string; count: number }[];
  perGmail: { address: string; sentCount: number; sendLimit: number }[];
  totals: {
    sent: number;
    failed: number;
    queued: number;
    totalSent: number;
    replies: number;
    replyRate: number; // replies / sent, 0..1
  };
}

const STATUS_ORDER = ["sent", "queued", "processing", "failed", "cancelled"];

/** Data for the analytics page charts. */
export async function getAnalytics(
  userId: string,
  days = 14,
): Promise<Analytics> {
  const [daily, breakdown, connections, replies] = await Promise.all([
    emailJobRepo.dailyActivity(userId, days),
    emailJobRepo.statusBreakdown(userId),
    getConnections(userId),
    emailJobRepo.countReplied(userId),
  ]);

  const statusBreakdown = STATUS_ORDER.filter((s) => breakdown[s]).map((s) => ({
    status: s,
    count: breakdown[s]!,
  }));

  const sent = breakdown["sent"] ?? 0;

  return {
    daily,
    statusBreakdown,
    perGmail: connections.map((c) => ({
      address: c.gmailAddress,
      sentCount: c.sentCount,
      sendLimit: c.sendLimit,
    })),
    totals: {
      sent,
      failed: breakdown["failed"] ?? 0,
      queued: breakdown["queued"] ?? 0,
      totalSent: daily.reduce((acc, d) => acc + d.sent, 0),
      replies,
      replyRate: sent > 0 ? replies / sent : 0,
    },
  };
}
