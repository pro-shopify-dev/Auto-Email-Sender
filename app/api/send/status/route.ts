import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getSendStatus } from "@/services/campaignService";

export const runtime = "nodejs";

/** Live sending status: remaining, sent, queued, and whether sending is stopped. */
export const GET = handler(async () => {
  const userId = await requireUserId();
  return ok(await getSendStatus(userId));
});
