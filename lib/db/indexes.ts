import {
  usersCol,
  gmailConnectionsCol,
  contactsCol,
  templatesCol,
  campaignsCol,
  emailJobsCol,
  auditLogsCol,
  gmailDraftsCol,
} from "@/lib/db/collections";

let ensured = false;

/**
 * Idempotently create all indexes. Safe to call repeatedly — Mongo ignores an index that
 * already exists. Called at worker startup and lazily on first DB access in dev.
 */
export async function ensureIndexes(): Promise<void> {
  if (ensured) return;

  const [users, gmail, contacts, templates, campaigns, jobs, audit, drafts] =
    await Promise.all([
      usersCol(),
      gmailConnectionsCol(),
      contactsCol(),
      templatesCol(),
      campaignsCol(),
      emailJobsCol(),
      auditLogsCol(),
      gmailDraftsCol(),
    ]);

  // Migration: earlier versions had a unique index on gmailConnections.userId (one Gmail
  // per user). Multi-Gmail requires dropping it so several accounts can share a userId.
  try {
    await gmail.dropIndex("userId_1");
  } catch {
    // Index doesn't exist (fresh DB or already migrated) — ignore.
  }

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),

    gmail.createIndex({ userId: 1, gmailAddress: 1 }, { unique: true }),
    gmail.createIndex({ userId: 1, status: 1 }),

    contacts.createIndex({ userId: 1, email: 1 }, { unique: true }),
    contacts.createIndex({ userId: 1, tags: 1 }),
    contacts.createIndex({ userId: 1, createdAt: -1 }),

    templates.createIndex({ userId: 1, name: 1 }),
    templates.createIndex({ userId: 1, createdAt: -1 }),

    campaigns.createIndex({ userId: 1, status: 1 }),
    campaigns.createIndex({ userId: 1, createdAt: -1 }),

    jobs.createIndex({ status: 1, scheduledAt: 1 }),
    jobs.createIndex({ status: 1, repliedAt: 1, updatedAt: 1 }),
    jobs.createIndex({ idempotencyKey: 1 }, { unique: true }),
    jobs.createIndex({ userId: 1, createdAt: -1 }),
    jobs.createIndex({ campaignId: 1 }),

    audit.createIndex({ userId: 1, createdAt: -1 }),

    drafts.createIndex({ connectionId: 1 }),
    drafts.createIndex({ connectionId: 1, gmailDraftId: 1 }, { unique: true }),
    drafts.createIndex({ userId: 1 }),
  ]);

  ensured = true;
}
