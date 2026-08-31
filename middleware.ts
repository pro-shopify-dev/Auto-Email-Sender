import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe: uses authConfig only (no DB/bcrypt). The `authorized` callback gates routes.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // NextAuth's `authorized` callback handles the redirect logic; nothing else needed here.
  void req;
});

export const config = {
  // Run on everything except static assets, images, and the auth API.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
