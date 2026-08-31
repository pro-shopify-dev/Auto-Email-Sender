import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { resetSending } from "@/services/campaignService";

export const runtime = "nodejs";

/**
 * Start fresh: mark all contacts un-emailed, delete all history, reset Gmail counters.
 * Contacts, templates, and connections are kept.
 */
export const POST = handler(async () => {
  const userId = await requireUserId();
  return ok(await resetSending(userId));
});
