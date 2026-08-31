import { ObjectId } from "mongodb";
import { DomainError } from "@/lib/errors";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  buildConsentUrl,
  exchangeCodeForTokens,
  resolveGmailAddress,
  gmailClientFromRefreshToken,
} from "@/lib/google";
import * as gmailRepo from "@/repositories/gmailRepo";
import * as draftPoolRepo from "@/repositories/draftPoolRepo";
import type {
  GmailConnectionDoc,
  PublicGmailConnection,
  ConnectionSettingsInput,
} from "@/models/gmailConnection";
import { connectionSettingsSchema } from "@/models/gmailConnection";
import { writeAudit } from "@/services/auditService";
import { buildRawEmail, type OutgoingEmail } from "@/lib/mime";

/** Step 1: URL the user is redirected to for Google consent. State = userId. */
export function getConsentUrl(userId: string): string {
  return buildConsentUrl(userId);
}

function toPublic(conn: GmailConnectionDoc): PublicGmailConnection {
  return {
    id: conn._id.toString(),
    gmailAddress: conn.gmailAddress,
    status: conn.status,
    enabled: conn.enabled,
    sendLimit: conn.sendLimit,
    sentCount: conn.sentCount,
    throttlePerWindow: conn.throttlePerWindow,
    throttleWindowSeconds: conn.throttleWindowSeconds,
    connectedAt: conn.createdAt.toISOString(),
  };
}

/** Step 2: handle the OAuth callback — exchange code, encrypt & persist tokens. Adds a new
 * connection (or refreshes an existing one for the same address) without touching others. */
export async function completeConnection(
  userId: string,
  code: string,
): Promise<void> {
  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refreshToken) {
    throw new DomainError(
      "Google did not return a refresh token. Remove this app's access in your Google account and try again.",
      400,
    );
  }
  const gmailAddress = await resolveGmailAddress(tokens);

  await gmailRepo.upsertConnection(userId, {
    gmailAddress,
    encryptedRefreshToken: encrypt(tokens.refreshToken),
    encryptedAccessToken: encrypt(tokens.accessToken),
    tokenExpiresAt: tokens.expiryDate ? new Date(tokens.expiryDate) : null,
  });

  await writeAudit(userId, "gmail.connect", { gmailAddress });
}

export async function getConnections(
  userId: string,
): Promise<PublicGmailConnection[]> {
  const docs = await gmailRepo.listByUser(userId);
  return docs.map(toPublic);
}

export async function countConnected(userId: string): Promise<number> {
  return gmailRepo.countConnected(userId);
}

export async function hasEligibleSender(userId: string): Promise<boolean> {
  return gmailRepo.hasEligibleSender(userId);
}

/** Address to use for test sends — the first connected account. */
export async function primarySendAddress(
  userId: string,
): Promise<string | null> {
  const docs = await gmailRepo.listByUser(userId);
  const connected = docs.find((d) => d.status === "connected") ?? docs[0];
  return connected?.gmailAddress ?? null;
}

export async function disconnect(userId: string, connId: string): Promise<void> {
  const ok = await gmailRepo.deleteConnection(userId, connId);
  if (!ok) throw new DomainError("Connection not found.", 404);
  // Forget the drafts we tracked for it (the drafts themselves stay in Gmail).
  if (ObjectId.isValid(connId)) {
    await draftPoolRepo.deleteAllForConnection(new ObjectId(connId));
  }
  await writeAudit(userId, "gmail.disconnect", { connId });
}

export async function resetCounter(userId: string, connId: string): Promise<void> {
  const ok = await gmailRepo.resetCounter(userId, connId);
  if (!ok) throw new DomainError("Connection not found.", 404);
  await writeAudit(userId, "gmail.reset_counter", { connId });
}

export async function updateConnectionSettings(
  userId: string,
  connId: string,
  raw: unknown,
): Promise<void> {
  const settings: ConnectionSettingsInput = connectionSettingsSchema.parse(raw);
  const ok = await gmailRepo.updateSettings(userId, connId, settings);
  if (!ok) throw new DomainError("Connection not found.", 404);
  await writeAudit(userId, "gmail.update_settings", { connId, settings });
}

/**
 * Send an email through a SPECIFIC connection (used by the worker for rotation).
 * Returns the Gmail message id.
 */
export interface SendResult {
  messageId: string;
  threadId: string | null;
}

export async function sendWithConnection(
  connection: GmailConnectionDoc,
  email: OutgoingEmail,
): Promise<SendResult> {
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const { gmail } = gmailClientFromRefreshToken(refreshToken);

  const raw = buildRawEmail({ ...email, from: connection.gmailAddress });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  const messageId = res.data.id;
  if (!messageId) throw new Error("Gmail API returned no message id.");
  return { messageId, threadId: res.data.threadId ?? null };
}

/**
 * True when Google rejects the account's refresh token itself — it was revoked, expired
 * (Testing-mode tokens die after 7 days), or the app's secret changed. The account must be
 * reconnected; retrying the same email won't help.
 */
export function isAuthError(err: unknown): boolean {
  const anyErr = err as { message?: string; response?: { data?: { error?: string } } };
  const msg = (anyErr?.message ?? "").toLowerCase();
  const oauthError = (anyErr?.response?.data?.error ?? "").toLowerCase();
  return (
    oauthError === "invalid_grant" ||
    msg.includes("invalid_grant") ||
    msg.includes("token has been expired or revoked") ||
    msg.includes("invalid credentials") ||
    msg.includes("no refresh token")
  );
}

/** True when Gmail rejects a call because the token lacks the required (compose) scope. */
export function isInsufficientScopeError(err: unknown): boolean {
  const anyErr = err as { code?: number; status?: number; message?: string };
  const code = anyErr?.code ?? anyErr?.status;
  const msg = (anyErr?.message ?? "").toLowerCase();
  return (
    code === 403 &&
    (msg.includes("insufficient") ||
      msg.includes("scope") ||
      msg.includes("permission"))
  );
}

export interface CreatedDraft {
  draftId: string;
  messageId: string;
  /** Stable across sending — the key to spotting a draft the user sent by hand. */
  threadId: string;
}

/** Create a Gmail draft (no recipient) in a connection's Drafts folder. */
export async function createDraftWithConnection(
  connection: GmailConnectionDoc,
  email: OutgoingEmail,
): Promise<CreatedDraft> {
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const { gmail } = gmailClientFromRefreshToken(refreshToken);

  const raw = buildRawEmail({ ...email, from: connection.gmailAddress });
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });

  const draftId = res.data.id;
  const messageId = res.data.message?.id;
  const threadId = res.data.message?.threadId;
  if (!draftId || !messageId || !threadId) {
    throw new Error("Gmail API returned no draft id.");
  }
  return { draftId, messageId, threadId };
}

/**
 * Ids of the drafts currently LISTED in the account — i.e. what Gmail actually shows in the
 * Drafts folder.
 *
 * This is deliberately `drafts.list` and not `drafts.get`: a draft the user deleted goes to
 * Trash, where `drafts.get` still returns it happily (so it looks alive) but `drafts.list`
 * correctly omits it. Listing is also one call instead of one per draft.
 */
export async function listDraftIds(
  connection: GmailConnectionDoc,
): Promise<Set<string>> {
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const { gmail } = gmailClientFromRefreshToken(refreshToken);

  const ids = new Set<string>();
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.drafts.list({
      userId: "me",
      maxResults: 500,
      pageToken,
    });
    for (const d of res.data.drafts ?? []) if (d.id) ids.add(d.id);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return ids;
}

export type DraftOutcome =
  | { kind: "sent"; messageId: string; threadId: string }
  | { kind: "deleted" }
  | { kind: "unknown" };

/**
 * Work out what happened to a draft that left the Drafts folder, by inspecting its THREAD.
 *
 * Sending a draft mints a brand-new message id (the draft's own id 404s afterwards), so the
 * message id is useless for this. The thread id, however, survives sending unchanged — and
 * the sent copy lands in that same thread carrying the SENT label. So: a SENT message in the
 * thread means the user sent it by hand; a missing thread, or one with no SENT message,
 * means the draft was thrown away.
 *
 * Reads headers only, which is all the gmail.metadata scope permits.
 */
export async function classifyVanishedDraft(
  connection: GmailConnectionDoc,
  gmailThreadId: string,
): Promise<DraftOutcome> {
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const { gmail } = gmailClientFromRefreshToken(refreshToken);
  try {
    const res = await gmail.users.threads.get({
      userId: "me",
      id: gmailThreadId,
      format: "metadata",
      metadataHeaders: ["To"],
    });
    const messages = res.data.messages ?? [];
    const sent = messages.find((m) => (m.labelIds ?? []).includes("SENT"));
    if (sent?.id) {
      return { kind: "sent", messageId: sent.id, threadId: gmailThreadId };
    }
    // Thread exists but nothing was sent from it — the draft was discarded.
    return { kind: "deleted" };
  } catch (err) {
    const code = (err as { code?: number; status?: number })?.code;
    if (code === 404) return { kind: "deleted" };
    throw err;
  }
}

/** Delete a draft from the account (ignores an already-gone draft). */
export async function deleteDraftWithConnection(
  connection: GmailConnectionDoc,
  draftId: string,
): Promise<void> {
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const { gmail } = gmailClientFromRefreshToken(refreshToken);
  try {
    await gmail.users.drafts.delete({ userId: "me", id: draftId });
  } catch (err) {
    const code = (err as { code?: number; status?: number })?.code;
    if (code !== 404) throw err;
  }
}

export interface ReplyCheck {
  replied: boolean;
  at: Date | null;
  count: number;
}

/**
 * Check a sent thread for a reply from the recipient, using the SENDING account's mailbox
 * (its inbox holds the reply). Reads headers only (gmail.metadata scope) — never bodies.
 */
export async function checkThreadForReply(
  connection: GmailConnectionDoc,
  threadId: string,
): Promise<ReplyCheck> {
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const { gmail } = gmailClientFromRefreshToken(refreshToken);

  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From"],
  });

  const messages = res.data.messages ?? [];
  const ours = connection.gmailAddress.toLowerCase();

  // A reply = any message in the thread NOT sent by us (i.e. from the recipient).
  const replies = messages.filter((m) => {
    const isSent = (m.labelIds ?? []).includes("SENT");
    const from = (
      m.payload?.headers?.find((h) => h.name?.toLowerCase() === "from")?.value ?? ""
    ).toLowerCase();
    return !isSent && from !== "" && !from.includes(ours);
  });

  if (replies.length === 0) return { replied: false, at: null, count: 0 };

  const dates = replies
    .map((m) => Number(m.internalDate ?? 0))
    .filter((n) => n > 0);
  const at = dates.length ? new Date(Math.min(...dates)) : new Date();
  return { replied: true, at, count: replies.length };
}

/** Re-export for the worker's sender pool. */
export const listEligibleSenders = gmailRepo.listEligibleSenders;
export const recordSend = gmailRepo.recordSend;
export const findConnectionById = gmailRepo.findById;
export type { GmailConnectionDoc };
export { ObjectId };
