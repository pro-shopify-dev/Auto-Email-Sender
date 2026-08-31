import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getStatus } from "@/services/draftPoolService";

export const runtime = "nodejs";

/** Current draft-pool status per connected Gmail. */
export const GET = handler(async () => {
  const userId = await requireUserId();
  return ok(await getStatus(userId));
});
