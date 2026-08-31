import { z } from "zod";
import type { ObjectId } from "mongodb";

export type EmailJobStatus =
  | "queued"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export interface EmailJobDoc {
  _id: ObjectId;
  userId: ObjectId;
  campaignId: ObjectId | null;
  recipientId: ObjectId | null;
  to: string;
  cc: string[];
  bcc: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  /** Which template this email used (null for composer/test sends). */
  templateId: ObjectId | null;
  templateName: string | null;
  /** The Gmail address that actually sent it (set when sent). */
  fromAddress: string | null;
  status: EmailJobStatus;
  scheduledAt: Date;
  gmailMessageId: string | null;
  /** Gmail thread id of the sent message — used to detect replies. */
  gmailThreadId: string | null;
  /** Which connected Gmail sent it (its mailbox holds the reply thread). */
  sentByConnectionId: ObjectId | null;
  /** Set when a reply from the recipient is detected in the thread. */
  repliedAt: Date | null;
  replyCount: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Payload for composing a single/test send from the composer. */
export const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1, "Add at least one recipient").max(100),
  cc: z.array(z.string().email()).max(100).optional().default([]),
  bcc: z.array(z.string().email()).max(100).optional().default([]),
  subject: z.string().trim().min(1, "Subject is required").max(500),
  htmlBody: z.string().min(1, "Body is required").max(200_000),
  textBody: z.string().max(200_000).optional().default(""),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  test: z.boolean().optional().default(false),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

export interface PublicEmailJob {
  id: string;
  campaignId: string | null;
  to: string;
  fromAddress: string | null;
  templateName: string | null;
  subject: string;
  status: EmailJobStatus;
  scheduledAt: string;
  gmailMessageId: string | null;
  attempts: number;
  lastError: string | null;
  repliedAt: string | null;
  replyCount: number;
  createdAt: string;
}

/** Full view of a single email, including the rendered body (for the "View" dialog). */
export interface PublicEmailJobDetail extends PublicEmailJob {
  cc: string[];
  bcc: string[];
  htmlBody: string;
}
