/**
 * Sending control: Start / Stop / status.
 *
 * There is no campaign concept — Start simply lines up one email for every contact that
 * hasn't been emailed yet and switches sending on. Stop pauses; Start resumes.
 */
import { ObjectId } from "mongodb";
import { DomainError } from "@/lib/errors";
import { ensureIndexes } from "@/lib/db/indexes";
import { startSendingSchema } from "@/models/campaign";
import { render, contactVariables } from "@/lib/template";
import { htmlToText } from "@/lib/mime";
import * as templateRepo from "@/repositories/templateRepo";
import * as contactRepo from "@/repositories/contactRepo";
import * as emailJobRepo from "@/repositories/emailJobRepo";
import type { NewJob } from "@/repositories/emailJobRepo";
import * as gmailRepo from "@/repositories/gmailRepo";
import * as sendStateRepo from "@/repositories/sendStateRepo";
import { writeAudit } from "@/services/auditService";

export interface SendStatus {
  /** Sending is stopped by the user. */
  paused: boolean;
  /** Contacts not yet successfully emailed (what Start will work through). */
  remaining: number;
  /** Contacts already emailed — never sent again. */
  sent: number;
  /** Emails lined up and waiting for the worker right now. */
  queued: number;
}

/** Live sending status: what's left, what's done, what's waiting, and start/stop state. */
export async function getSendStatus(userId: string): Promise<SendStatus> {
  const [paused, remaining, sent, queued, processing] = await Promise.all([
    sendStateRepo.isPaused(userId),
    contactRepo.countSendable(userId),
    contactRepo.countEmailed(userId),
    emailJobRepo.countByStatus(userId, "queued"),
    emailJobRepo.countByStatus(userId, "processing"),
  ]);
  return { paused, remaining, sent, queued: queued + processing };
}

/** Stop sending. Queued emails are held (not lost) until Start resumes them. */
export async function stopSending(userId: string): Promise<void> {
  await sendStateRepo.setPaused(userId, true);
  await writeAudit(userId, "send.stop", {});
}

export interface ResetResult {
  contactsReset: number;
  historyDeleted: number;
}

/**
 * Start fresh: mark EVERY contact as not-yet-emailed, delete all email history, reset each
 * Gmail's sent counter, and switch sending on. After this, Start will email everyone again.
 * Contacts, templates, and Gmail connections are kept.
 */
export async function resetSending(userId: string): Promise<ResetResult> {
  const [contactsReset, historyDeleted] = await Promise.all([
    contactRepo.resetAllEmailed(userId),
    emailJobRepo.deleteAllForUser(userId),
  ]);
  await gmailRepo.resetAllCounters(userId);
  await sendStateRepo.setPaused(userId, false);
  await writeAudit(userId, "send.reset", { contactsReset, historyDeleted });
  return { contactsReset, historyDeleted };
}

/**
 * Start (or resume) sending. Lines up ONE email for every contact that hasn't been
 * emailed yet and switches sending on. No campaign/run record — just a queue.
 *
 * Safe to press repeatedly: the unique `contact:<id>` idempotency key means a contact can
 * only ever have one email, so re-pressing Start never duplicates anyone — it simply
 * resumes and picks up any contacts added since.
 */
export async function startSending(
  userId: string,
  raw: unknown,
): Promise<SendStatus> {
  await ensureIndexes();
  const input = startSendingSchema.parse(raw);

  if ((await gmailRepo.countConnected(userId)) === 0) {
    throw new DomainError("Connect a Gmail account before sending.", 400);
  }

  const templates = (
    await Promise.all(
      input.templateIds.map((id) => templateRepo.findById(userId, id)),
    )
  ).filter((t): t is NonNullable<typeof t> => t !== null);
  if (templates.length === 0) {
    throw new DomainError("None of the selected templates were found.", 404);
  }

  const sendable = await contactRepo.findSendable(userId);
  if (sendable.length === 0) {
    throw new DomainError(
      "Nothing left to send — every active contact has already been emailed. Import or add new contacts.",
      400,
    );
  }

  // Cancelled/failed emails still hold their contact's idempotency key, which would
  // silently block re-queueing them. Retire those keys first so Start can pick them up.
  await emailJobRepo.retireStaleContactJobs(userId);

  const now = new Date();

  // Contacts are marked emailed by the worker when the email ACTUALLY goes out — not
  // here — so Stop/Start always resumes exactly where it left off.
  const jobs: NewJob[] = sendable.map((contact) => {
    const template = templates[Math.floor(Math.random() * templates.length)]!;
    const vars = contactVariables(contact);
    const html = render(template.htmlBody, vars);
    return {
      userId: new ObjectId(userId),
      campaignId: null,
      recipientId: contact._id,
      to: contact.email,
      cc: [],
      bcc: [],
      subject: render(template.subject, vars),
      htmlBody: html,
      textBody: htmlToText(html),
      templateId: template._id,
      templateName: template.name,
      scheduledAt: now,
      maxAttempts: 3,
      // Global per-contact key: a contact can only ever have ONE email job.
      idempotencyKey: `contact:${contact._id.toString()}`,
    };
  });

  const enqueued = await emailJobRepo.insertManyIgnoreDupes(jobs);

  // Switch sending on (this is also what "resume after Stop" does).
  await sendStateRepo.setPaused(userId, false);

  await writeAudit(userId, "send.start", { enqueued, remaining: sendable.length });

  return getSendStatus(userId);
}
