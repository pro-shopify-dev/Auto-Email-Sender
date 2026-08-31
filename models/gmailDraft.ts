import type { ObjectId } from "mongodb";

/**
 * One ready-to-send draft this app created inside a connected Gmail's Drafts folder,
 * addressed to a real contact and rendered from a template.
 *
 * The contact is *reserved* while the draft waits, so the auto-sender never emails them
 * too. When the draft leaves the Drafts folder we work out what happened:
 *  - sent by hand  -> recorded in history, contact marked emailed, thread watched for replies
 *  - deleted       -> the contact is released back into the sendable pool
 * Either way the pool is topped back up to its target size.
 */
export interface GmailDraftDoc {
  _id: ObjectId;
  userId: ObjectId;
  connectionId: ObjectId;
  gmailAddress: string;
  /** Gmail's draft id (what we list/delete against). */
  gmailDraftId: string;
  /** The message id inside the draft. Note: sending mints a NEW id, so this is not the
   *  sent message's id — it is only useful while the draft is still a draft. */
  gmailMessageId: string;
  /** Thread id, which survives sending unchanged — how we detect a hand-sent draft. */
  gmailThreadId: string;
  /** The contact this draft is addressed to (held/reserved until sent or deleted). */
  contactId: ObjectId | null;
  toEmail: string;
  templateId: ObjectId | null;
  templateName: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  createdAt: Date;
}
