import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { listHistory } from "@/services/historyService";

export const runtime = "nodejs";

export const GET = handler(async (req: NextRequest) => {
  const userId = await requireUserId();
  const sp = req.nextUrl.searchParams;
  const result = await listHistory(userId, {
    status: sp.get("status") ?? undefined,
    campaignId: sp.get("campaignId") ?? undefined,
    search: sp.get("search") ?? undefined,
    repliedOnly: sp.get("replied") === "1",
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
  });
  return ok(result);
});
