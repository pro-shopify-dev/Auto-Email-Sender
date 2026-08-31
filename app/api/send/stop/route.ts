import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { stopSending, getSendStatus } from "@/services/campaignService";

export const runtime = "nodejs";

/** Stop sending. Queued emails are held — Start resumes exactly where it left off. */
export const POST = handler(async () => {
  const userId = await requireUserId();
  await stopSending(userId);
  return ok(await getSendStatus(userId));
});
