import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { createContact, listContacts } from "@/services/contactService";

export const runtime = "nodejs";

export const GET = handler(async (req: NextRequest) => {
  const userId = await requireUserId();
  const sp = req.nextUrl.searchParams;
  const result = await listContacts(userId, {
    search: sp.get("search") ?? undefined,
    tag: sp.get("tag") ?? undefined,
    stage: sp.get("stage") ?? sp.get("status") ?? undefined,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
  });
  return ok(result);
});

export const POST = handler(async (req: NextRequest) => {
  const userId = await requireUserId();
  const body = await req.json();
  const contact = await createContact(userId, body);
  return ok(contact, 201);
});
