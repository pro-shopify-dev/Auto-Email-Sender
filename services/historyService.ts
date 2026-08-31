import { DomainError } from "@/lib/errors";
import { toPublicEmailJob, toPublicEmailJobDetail } from "@/lib/serialize";
import type {
  EmailJobStatus,
  PublicEmailJob,
  PublicEmailJobDetail,
} from "@/models/emailJob";
import * as emailJobRepo from "@/repositories/emailJobRepo";
import { writeAudit } from "@/services/auditService";

const STATUSES: EmailJobStatus[] = [
  "queued",
  "processing",
  "sent",
  "failed",
  "cancelled",
];

export interface HistoryResult {
  items: PublicEmailJob[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listHistory(
  userId: string,
  opts: {
    status?: string;
    campaignId?: string;
    search?: string;
    repliedOnly?: boolean;
    page?: number;
    pageSize?: number;
  },
): Promise<HistoryResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const status =
    opts.status && STATUSES.includes(opts.status as EmailJobStatus)
      ? (opts.status as EmailJobStatus)
      : undefined;

  const { items, total } = await emailJobRepo.list(userId, {
    status,
    campaignId: opts.campaignId,
    search: opts.search,
    repliedOnly: opts.repliedOnly,
    page,
    pageSize,
  });

  return { items: items.map(toPublicEmailJob), total, page, pageSize };
}

/** Full detail of one email (for the View dialog). */
export async function getHistoryDetail(
  userId: string,
  id: string,
): Promise<PublicEmailJobDetail> {
  const doc = await emailJobRepo.findByIdForUser(userId, id);
  if (!doc) throw new DomainError("Email not found.", 404);
  return toPublicEmailJobDetail(doc);
}

/** Cancel a queued email so it won't be sent. */
export async function cancelHistoryJob(userId: string, id: string): Promise<void> {
  const ok = await emailJobRepo.cancelJob(userId, id);
  if (!ok) throw new DomainError("Only queued emails can be cancelled.", 409);
  await writeAudit(userId, "email.cancel", { jobId: id });
}

/** Delete an email log entry. */
export async function deleteHistoryJob(userId: string, id: string): Promise<void> {
  const ok = await emailJobRepo.removeJob(userId, id);
  if (!ok) throw new DomainError("Email not found.", 404);
  await writeAudit(userId, "email.delete", { jobId: id });
}
