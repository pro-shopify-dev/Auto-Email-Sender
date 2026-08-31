# Database Schema (MongoDB)

Native driver. All ids are `ObjectId`. All user-owned docs carry `userId: ObjectId`.
Timestamps are `Date`.

## users
| field        | type   | notes                          |
| ------------ | ------ | ------------------------------ |
| _id          | ObjectId |                              |
| name         | string |                                |
| email        | string | **unique index**               |
| passwordHash | string | bcrypt                         |
| role         | string | `user` \| `admin`              |
| createdAt    | Date   |                                |

Indexes: `{ email: 1 }` unique.

## gmailConnections
| field                 | type     | notes                         |
| --------------------- | -------- | ----------------------------- |
| userId                | ObjectId | owner                         |
| gmailAddress          | string   | connected address             |
| encryptedRefreshToken | string   | AES-256-GCM payload           |
| encryptedAccessToken  | string   | AES-256-GCM payload           |
| tokenExpiresAt        | Date     |                               |
| status                | string   | `connected` \| `revoked` \| `error` |
| createdAt / updatedAt | Date     |                               |

Indexes: `{ userId: 1 }` unique. **No Gmail passwords are ever stored.**

## contacts
firstName, lastName, email, phone, company, jobTitle, address, city, state, zipCode,
country, notes, tags (string[]), emailStatus (`active`|`bounced`|`unsubscribed`), userId,
createdAt, updatedAt.

Indexes: **`{ userId: 1, email: 1 }` unique** (dedupe per user), `{ userId: 1, tags: 1 }`.

## templates
name, subject, htmlBody, textBody, variables (string[]), userId, createdAt, updatedAt.

Indexes: `{ userId: 1, name: 1 }`.

## campaigns
name, templateId (ObjectId), status (`draft`|`queued`|`sending`|`completed`|`failed`),
scheduledAt (Date|null), sentCount (int), failedCount (int), totalCount (int), userId,
createdAt, updatedAt.

Indexes: `{ userId: 1, status: 1 }`, `{ userId: 1, createdAt: -1 }`.

## emailJobs  (the queue)
| field          | type     | notes                                            |
| -------------- | -------- | ------------------------------------------------ |
| userId         | ObjectId |                                                  |
| campaignId     | ObjectId \| null | null for single/test sends                |
| recipientId    | ObjectId \| null | contact id if applicable                  |
| to             | string   | recipient email                                  |
| subject        | string   | rendered                                         |
| htmlBody       | string   | rendered                                         |
| textBody       | string   | rendered                                         |
| cc / bcc       | string[] |                                                  |
| status         | string   | `queued`\|`processing`\|`sent`\|`failed`\|`cancelled` |
| scheduledAt    | Date     | run at/after                                     |
| gmailMessageId | string   | set on success                                   |
| attempts       | int      | retry counter                                    |
| maxAttempts    | int      | default 3                                        |
| lastError      | string   |                                                  |
| idempotencyKey | string   | **unique index**; e.g. `campaignId:recipientId`  |
| createdAt / updatedAt | Date |                                               |

Indexes: `{ status: 1, scheduledAt: 1 }` (worker claim), `{ idempotencyKey: 1 }` unique,
`{ userId: 1, createdAt: -1 }`, `{ campaignId: 1 }`.

## auditLogs
action (string), userId (ObjectId), meta (object), createdAt (Date).

Indexes: `{ userId: 1, createdAt: -1 }`.

## Index bootstrap
`lib/db/indexes.ts` creates all indexes idempotently; invoked at worker startup and on
first DB access in dev.
