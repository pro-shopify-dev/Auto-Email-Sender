import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { completeConnection } from "@/services/gmailService";

export const runtime = "nodejs";

/**
 * Google redirects here with ?code & ?state. We verify the signed-in user matches the
 * state, exchange the code, and store encrypted tokens. Then bounce back to Settings.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const settings = new URL("/settings", req.url);

  if (error) {
    settings.searchParams.set("gmail", "denied");
    return NextResponse.redirect(settings);
  }
  if (!code || state !== user.id) {
    settings.searchParams.set("gmail", "error");
    return NextResponse.redirect(settings);
  }

  try {
    await completeConnection(user.id, code);
    settings.searchParams.set("gmail", "connected");
  } catch (err) {
    console.error("[gmail.callback]", err);
    settings.searchParams.set("gmail", "error");
    const reason = err instanceof Error ? err.message : "Unknown error";
    settings.searchParams.set("reason", reason.slice(0, 200));
  }
  return NextResponse.redirect(settings);
}
