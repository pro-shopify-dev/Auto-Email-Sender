import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { reconcileUser } from "@/services/draftPoolService";

export const runtime = "nodejs";

/** Top every connected Gmail back up to the target number of template drafts, right now. */
export const POST = handler(async () => {
  const userId = await requireUserId();
  return ok(await reconcileUser(userId));
});
