import { DomainError } from "@/lib/errors";
import { ensureIndexes } from "@/lib/db/indexes";
import { toPublicContact } from "@/lib/serialize";
import {
  contactInputSchema,
  CONTACT_STAGES,
  type ContactInput,
  type ContactStage,
  type PublicContact,
} from "@/models/contact";
import * as contactRepo from "@/repositories/contactRepo";

export interface ListContactsResult {
  items: PublicContact[];
  total: number;
  page: number;
  pageSize: number;
  /** How many contacts sit in each stage (whole list, ignoring the current filter). */
  stageCounts: Record<ContactStage, number>;
}

function parseStage(value?: string): ContactStage | undefined {
  return CONTACT_STAGES.includes(value as ContactStage)
    ? (value as ContactStage)
    : undefined;
}

export async function listContacts(
  userId: string,
  opts: {
    search?: string;
    tag?: string;
    stage?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<ListContactsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const [{ items, total }, stageCounts] = await Promise.all([
    contactRepo.list(userId, {
      search: opts.search,
      tag: opts.tag,
      stage: parseStage(opts.stage),
      page,
      pageSize,
    }),
    contactRepo.stageCounts(userId),
  ]);
  return {
    items: items.map(toPublicContact),
    total,
    page,
    pageSize,
    stageCounts,
  };
}

export async function createContact(
  userId: string,
  raw: unknown,
): Promise<PublicContact> {
  await ensureIndexes();
  const input = contactInputSchema.parse(raw);
  try {
    const doc = await contactRepo.create(userId, input);
    return toPublicContact(doc);
  } catch (err) {
    throw mapDuplicate(err);
  }
}

export async function updateContact(
  userId: string,
  id: string,
  raw: unknown,
): Promise<void> {
  const input: ContactInput = contactInputSchema.parse(raw);
  let ok: boolean;
  try {
    ok = await contactRepo.update(userId, id, input);
  } catch (err) {
    throw mapDuplicate(err);
  }
  if (!ok) throw new DomainError("Contact not found.", 404);
}

export async function deleteContact(userId: string, id: string): Promise<void> {
  const ok = await contactRepo.remove(userId, id);
  if (!ok) throw new DomainError("Contact not found.", 404);
}

function mapDuplicate(err: unknown): unknown {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    return new DomainError("A contact with that email already exists.", 409);
  }
  return err;
}
