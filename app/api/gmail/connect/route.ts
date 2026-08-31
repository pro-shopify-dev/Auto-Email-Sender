import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getConsentUrl } from "@/services/gmailService";

export const runtime = "nodejs";

/** Redirects the signed-in user to Google's consent screen. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const url = getConsentUrl(user.id);
  return NextResponse.redirect(url);
}
