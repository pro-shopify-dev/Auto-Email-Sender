import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { DomainError } from "@/lib/errors";
import { ensureIndexes } from "@/lib/db/indexes";
import { sendEmailSchema, type PublicEmailJob } from "@/models/emailJob";
import { toPublicEmailJob } from "@/lib/serialize";
import * as emailJobRepo from "@/repositories/emailJobRepo";
import * as gmailRepo from "@/repositories/gmailRepo";
import { htmlToText } from "@/lib/mime";
import { writeAudit } from "@/services/auditService";

/**
 * Enqueue a single (or test) email from the composer. Creates ONE emailJob for the whole
 * To/Cc/Bcc set. The worker performs the actual Gmail send — we never send in this request.
 */
export async function enqueueSingle(
  userId: string,
  raw: unknown,
): Promise<PublicEmailJob> {
  await ensureIndexes();
  const input = sendEmailSchema.parse(raw);

  // Require at least one connected Gmail up front so the user gets immediate feedback.
  const connections = await gmailRepo.listByUser(userId);
  const firstConnected = connections.find((c) => c.status === "connected");
  if (!firstConnected) {
    throw new DomainError(
      "Connect a Gmail account in Settings before sending.",
      400,
    );
  }

  // Test sends go to the first connected account's own address.
  const recipients = input.test ? [firstConnected.gmailAddress] : input.to;
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
  const textBody = input.textBody?.trim() ? input.textBody : htmlToText(input.htmlBody);

  const job = await emailJobRepo.insertOne({
    userId: new ObjectId(userId),
    campaignId: null,
    recipientId: null,
    to: recipients.join(", "),
    cc: input.test ? [] : input.cc,
    bcc: input.test ? [] : input.bcc,
    subject: input.test ? `[TEST] ${input.subject}` : input.subject,
    htmlBody: input.htmlBody,
    textBody,
    templateId: null,
    templateName: input.test ? "Test send" : "Composer",
    scheduledAt,
    maxAttempts: 3,
    idempotencyKey: `single:${randomUUID()}`,
  });

  await writeAudit(userId, input.test ? "email.test" : "email.enqueue", {
    jobId: job._id.toString(),
    recipients: recipients.length,
  });

  return toPublicEmailJob(job);
}
