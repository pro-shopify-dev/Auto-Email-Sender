/**
 * Draft pool: keep a fixed number of ready-to-send drafts waiting in each connected Gmail's
 * Drafts folder, each addressed to a real contact and rendered from a template.
 *
 * The loop, run every minute by the worker:
 *  1. List what's actually in the Drafts folder.
 *  2. For every draft of ours that's gone, find out why:
 *       sent by hand -> record it in history, mark the contact emailed, watch for replies
 *       deleted      -> release the contact back into the sendable pool
 *  3. Top the pool back up to its target size, claiming fresh contacts.
 *
 * A contact held by a waiting draft is "reserved" and skipped by the auto-sender, so nobody
 * ever receives both a manual draft and an automatic email.
 */
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { render, contactVariables } from "@/lib/template";
import { htmlToText } from "@/lib/mime";
import * as templateRepo from "@/repositories/templateRepo";
import * as draftPoolRepo from "@/repositories/draftPoolRepo";
import * as contactRepo from "@/repositories/contactRepo";
import * as emailJobRepo from "@/repositories/emailJobRepo";
import * as gmailRepo from "@/repositories/gmailRepo";
import {
  createDraftWithConnection,
  deleteDraftWithConnection,
  listDraftIds,
  classifyVanishedDraft,
  isInsufficientScopeError,
  isAuthError,
  type GmailConnectionDoc,
} from "@/services/gmailService";

/** Errors that mean "this account needs reconnecting, stop trying it". */
function needsReconnectError(err: unknown): boolean {
  return isInsufficientScopeError(err) || isAuthError(err);
}

/** Flag a connection whose token/scope is bad so it stops being used and shows in Settings. */
async function flagRevoked(connection: GmailConnectionDoc): Promise<void> {
  await gmailRepo.setStatus(connection._id, "revoked");
}
import type { GmailDraftDoc } from "@/models/gmailDraft";

export interface ReconcilePlan {
  toCreate: number;
  toDelete: number;
}

/** Pure decision: how many drafts to add/remove to reach the target pool size. */
export function planReconcile(current: number, target: number): ReconcilePlan {
  const safeTarget = Math.max(0, target);
  if (current < safeTarget) return { toCreate: safeTarget - current, toDelete: 0 };
  if (current > safeTarget) return { toCreate: 0, toDelete: current - safeTarget };
  return { toCreate: 0, toDelete: 0 };
}

export interface ReconcileResult {
  created: number;
  /** Drafts the user sent by hand — now recorded in history. */
  sent: number;
  /** Drafts deleted without sending — their contacts went back to the pool. */
  released: number;
  deleted: number;
  needsReconnect: boolean;
  skipped?: "disabled" | "no-templates";
}

const EMPTY: ReconcileResult = {
  created: 0,
  sent: 0,
  released: 0,
  deleted: 0,
  needsReconnect: false,
};

/**
 * Record a hand-sent draft as a sent email, so it shows in History with From/To/template
 * and gets picked up by the reply checker (status "sent" + thread id + connection).
 */
async function recordHandSend(
  connection: GmailConnectionDoc,
  draft: GmailDraftDoc,
  sentMessageId: string,
  threadId: string,
): Promise<void> {
  const userId = connection.userId.toString();

  await emailJobRepo.insertManyIgnoreDupes([
    {
      userId: connection.userId,
      campaignId: null,
      recipientId: draft.contactId,
      to: draft.toEmail,
      cc: [],
      bcc: [],
      subject: draft.subject,
      htmlBody: draft.htmlBody,
      textBody: draft.textBody,
      templateId: draft.templateId,
      templateName: draft.templateName,
      scheduledAt: draft.createdAt,
      maxAttempts: 1,
      // Same per-contact key the auto-sender uses, so a contact can only ever have one email.
      idempotencyKey: draft.contactId
        ? `contact:${draft.contactId.toString()}`
        : `draft:${draft.gmailDraftId}`,
      status: "sent",
    },
  ]);

  // insertManyIgnoreDupes can't set send-time fields, so stamp them on afterwards.
  await emailJobRepo.markSentByIdempotencyKey(
    draft.contactId
      ? `contact:${draft.contactId.toString()}`
      : `draft:${draft.gmailDraftId}`,
    sentMessageId,
    threadId,
    connection._id,
    connection.gmailAddress,
  );

  if (draft.contactId) {
    await contactRepo.markEmailed(userId, [draft.contactId]);
  }
  // The account really did send a message — count it against its cap.
  await gmailRepo.recordSend(connection._id);
}

/**
 * Bring one connection's draft pool to the target size, handling anything that left the
 * Drafts folder since the last pass.
 */
export async function reconcileConnection(
  connection: GmailConnectionDoc,
): Promise<ReconcileResult> {
  if (!env.draftPoolEnabled) return { ...EMPTY, skipped: "disabled" };

  const target = env.draftPoolSize;
  const userId = connection.userId.toString();

  const templates = await templateRepo.list(userId);
  if (templates.length === 0) return { ...EMPTY, skipped: "no-templates" };

  const tracked = await draftPoolRepo.listByConnection(connection._id);

  // 1. What is actually still sitting in the Drafts folder?
  let listed: Set<string>;
  try {
    listed = await listDraftIds(connection);
  } catch (err) {
    if (needsReconnectError(err)) {
      await flagRevoked(connection);
      return { ...EMPTY, needsReconnect: true };
    }
    throw err;
  }

  const present = tracked.filter((d) => listed.has(d.gmailDraftId));
  const vanished = tracked.filter((d) => !listed.has(d.gmailDraftId));

  // Legacy recipient-less drafts from the earlier design: remove them so the pool is made
  // up entirely of real, addressed, ready-to-send drafts.
  const legacy = present.filter((d) => !d.contactId);
  for (const d of legacy) {
    await deleteDraftWithConnection(connection, d.gmailDraftId);
    await draftPoolRepo.removeByDraftIds(connection._id, [d.gmailDraftId]);
  }
  const alive = present.filter((d) => d.contactId);

  // 2. Sent by hand, or thrown away?
  let sent = 0;
  let released = 0;
  const settled: string[] = [];
  const toRelease: ObjectId[] = [];

  for (const draft of vanished) {
    let outcome;
    try {
      // Older records predate the stored thread id; for a fresh draft Gmail sets the
      // message id and thread id to the same value, so that's a safe fallback.
      const threadId = draft.gmailThreadId || draft.gmailMessageId;
      outcome = await classifyVanishedDraft(connection, threadId);
    } catch (err) {
      if (needsReconnectError(err)) {
        await flagRevoked(connection);
        return { ...EMPTY, needsReconnect: true };
      }
      console.error(
        `[draft-pool] could not classify draft ${draft.gmailDraftId}:`,
        err instanceof Error ? err.message : err,
      );
      continue; // leave the record; try again next pass
    }

    if (outcome.kind === "sent") {
      await recordHandSend(connection, draft, outcome.messageId, outcome.threadId);
      settled.push(draft.gmailDraftId);
      sent++;
    } else if (outcome.kind === "deleted") {
      if (draft.contactId) toRelease.push(draft.contactId);
      settled.push(draft.gmailDraftId);
      released++;
    }
    // "unknown" -> keep the record and re-check next pass.
  }

  await contactRepo.releaseDraftReservations(userId, toRelease);
  await draftPoolRepo.removeByDraftIds(connection._id, settled);

  // 3. Trim if we're somehow over target (e.g. the target was lowered).
  const plan = planReconcile(alive.length, target);
  let deleted = 0;
  if (plan.toDelete > 0) {
    for (const d of alive.slice(-plan.toDelete)) {
      await deleteDraftWithConnection(connection, d.gmailDraftId);
      await draftPoolRepo.removeByDraftIds(connection._id, [d.gmailDraftId]);
      if (d.contactId) await contactRepo.releaseDraftReservations(userId, [d.contactId]);
      deleted++;
    }
  }

  // 4. Refill: claim a contact per new draft and render the template for them.
  let created = 0;
  if (plan.toCreate > 0) {
    // Fill in batches — a large pool builds up over successive passes rather than firing
    // hundreds of Gmail calls at once.
    const wanted = Math.min(plan.toCreate, Math.max(1, env.draftFillBatch));
    const contacts = await contactRepo.claimForDrafts(userId, wanted);

    for (let k = 0; k < contacts.length; k++) {
      const contact = contacts[k]!;
      const template = templates[(alive.length + k) % templates.length]!;
      const vars = contactVariables(contact); // no first name -> "there"
      const subject = render(template.subject, vars);
      const htmlBody = render(template.htmlBody, vars);
      const textBody = render(template.textBody ?? "", vars) || htmlToText(htmlBody);

      try {
        const { draftId, messageId, threadId } = await createDraftWithConnection(connection, {
          to: [contact.email],
          cc: [],
          bcc: [],
          subject,
          htmlBody,
          textBody,
        });
        await draftPoolRepo.record({
          userId: connection.userId,
          connectionId: connection._id,
          gmailAddress: connection.gmailAddress,
          gmailDraftId: draftId,
          gmailMessageId: messageId,
          gmailThreadId: threadId,
          contactId: contact._id,
          toEmail: contact.email,
          templateId: template._id,
          templateName: template.name,
          subject,
          htmlBody,
          textBody,
        });
        created++;
      } catch (err) {
        // Hand the contact back so a failure never silently burns them.
        await contactRepo.releaseDraftReservations(userId, [contact._id]);
        if (needsReconnectError(err)) {
          await flagRevoked(connection);
          return { created, sent, released, deleted, needsReconnect: true };
        }
        throw err;
      }
    }
  }

  return { created, sent, released, deleted, needsReconnect: false };
}

export interface DraftPoolAccount {
  connectionId: string;
  gmailAddress: string;
  /** Drafts we currently keep in this account's Drafts folder. */
  pool: number;
}

export interface DraftPoolStatus {
  enabled: boolean;
  target: number;
  hasTemplates: boolean;
  /** Contacts currently held by waiting drafts. */
  reserved: number;
  accounts: DraftPoolAccount[];
}

/**
 * Fast status straight from our tracking records. Reconcile prunes records for drafts Gmail
 * no longer lists, so this count matches the real Drafts folder as of the last reconcile.
 */
export async function getStatus(userId: string): Promise<DraftPoolStatus> {
  const [connections, templateCount, reserved] = await Promise.all([
    gmailRepo.listByUser(userId),
    templateRepo.countForUser(userId),
    contactRepo.countDraftReserved(userId),
  ]);

  const accounts = await Promise.all(
    connections.map(async (c) => ({
      connectionId: c._id.toString(),
      gmailAddress: c.gmailAddress,
      pool: (await draftPoolRepo.listByConnection(c._id)).length,
    })),
  );

  return {
    enabled: env.draftPoolEnabled,
    target: env.draftPoolSize,
    hasTemplates: templateCount > 0,
    reserved,
    accounts,
  };
}

export interface ReconcileAllSummary {
  connections: number;
  created: number;
  sent: number;
  released: number;
  deleted: number;
  needsReconnect: string[];
}

function emptySummary(): ReconcileAllSummary {
  return {
    connections: 0,
    created: 0,
    sent: 0,
    released: 0,
    deleted: 0,
    needsReconnect: [],
  };
}

/**
 * Free any contact left flagged as reserved with no draft actually holding it — self-healing
 * after a crash, an interrupted pass, or a draft removed outside the app.
 */
async function sweepOrphanReservations(userId: string): Promise<number> {
  const held = await draftPoolRepo.listHeldContactIds(userId);
  return contactRepo.releaseOrphanReservations(userId, held);
}

function merge(summary: ReconcileAllSummary, r: ReconcileResult, address: string): void {
  summary.created += r.created;
  summary.sent += r.sent;
  summary.released += r.released;
  summary.deleted += r.deleted;
  if (r.needsReconnect) summary.needsReconnect.push(address);
}

/** Reconcile every connected account belonging to ONE user (the "Refill now" button). */
export async function reconcileUser(userId: string): Promise<ReconcileAllSummary> {
  const summary = emptySummary();
  if (!env.draftPoolEnabled) return summary;

  const connections = (await gmailRepo.listByUser(userId)).filter(
    gmailRepo.canManageDrafts,
  );
  for (const conn of connections) {
    summary.connections++;
    merge(summary, await reconcileConnection(conn), conn.gmailAddress);
  }
  summary.released += await sweepOrphanReservations(userId);
  return summary;
}

/** Reconcile the draft pool for every connected account (all users). Best-effort: a failure
 * on one account is logged and does not stop the others. */
export async function reconcileAll(): Promise<ReconcileAllSummary> {
  const summary = emptySummary();
  if (!env.draftPoolEnabled) return summary;

  const connections = await gmailRepo.listAllDraftCapable();
  const userIds = new Set<string>();
  for (const conn of connections) {
    summary.connections++;
    userIds.add(conn.userId.toString());
    try {
      merge(summary, await reconcileConnection(conn), conn.gmailAddress);
    } catch (err) {
      console.error(
        `[draft-pool] reconcile failed for ${conn.gmailAddress}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  for (const userId of userIds) {
    try {
      summary.released += await sweepOrphanReservations(userId);
    } catch (err) {
      console.error(
        "[draft-pool] reservation sweep failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return summary;
}
