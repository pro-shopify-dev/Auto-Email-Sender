import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getConnections } from "@/services/gmailService";

export const runtime = "nodejs";

/** List all of the user's connected Gmail accounts. */
export const GET = handler(async () => {
  const userId = await requireUserId();
  return ok(await getConnections(userId));
});
