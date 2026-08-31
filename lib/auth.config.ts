import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth configuration (no DB / bcrypt imports) so it can run in middleware.
 * Providers are added in lib/auth.ts, which runs in the Node.js runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isOnDashboard =
        nextUrl.pathname.startsWith("/dashboard") ||
        ["/compose", "/contacts", "/templates", "/campaigns", "/history", "/settings"].some(
          (p) => nextUrl.pathname.startsWith(p),
        );

      if (isOnDashboard) {
        return isLoggedIn; // redirect unauthenticated users to /login
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // populated in lib/auth.ts
} satisfies NextAuthConfig;
