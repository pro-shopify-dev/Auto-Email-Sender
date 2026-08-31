import dns from "node:dns";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { env } from "@/lib/env";

// Prefer IPv4 when resolving Google's hosts. On machines with broken/half-configured IPv6,
// Node otherwise picks an IPv6 route to oauth2.googleapis.com that resets mid-response
// ("Premature close") — even though the browser reached Google fine (it falls back to IPv4).
// This makes the server behave like the browser. Harmless on healthy IPv6 setups.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Older Node without this API — ignore.
}

/**
 * Scopes:
 *  - gmail.send        : send mail on the user's behalf
 *  - gmail.compose     : create/list/delete DRAFTS — used to keep a small pool of template
 *                        drafts sitting in the account's Drafts folder.
 *  - gmail.metadata    : read message HEADERS only (From/Date/labels) — used to detect
 *                        replies to sent threads. Cannot read message bodies.
 *  - openid + email    : so we can read which address was connected (userinfo)
 *
 * NOTE: adding gmail.compose changes the requested scope set, so accounts connected before
 * this change must be reconnected once to grant the new draft permission.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.metadata",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri,
  );
}

/** Build the consent URL. `state` carries the userId (signed by our own session earlier). */
export function buildConsentUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force a refresh_token every time
    scope: GMAIL_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  idToken: string | null;
}

/** True for transient network drops worth retrying (proxy/VPN/AV resets, timeouts). */
function isTransientNetworkError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const code = (err as { code?: string })?.code ?? "";
  return (
    msg.includes("premature close") ||
    msg.includes("socket hang up") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EPIPE", "UND_ERR_SOCKET"].includes(code)
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isTransientNetworkError(err)) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<ExchangedTokens> {
  // A fresh client per attempt; the auth code is single-use, but getToken only consumes it
  // on a real HTTP response — a premature close means it was never redeemed, so retry is safe.
  const { tokens } = await withRetry(() => createOAuthClient().getToken(code));
  return {
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
    idToken: tokens.id_token ?? null,
  };
}

/** Extract the `email` claim from a Google id_token (JWT) without signature checks —
 * the token came straight from Google's token endpoint over TLS, so it's trusted. */
function emailFromIdToken(idToken: string | null): string {
  if (!idToken) return "";
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return "";
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(json) as { email?: string };
    return claims.email ?? "";
  } catch {
    return "";
  }
}

/**
 * Determine the connected address. Prefers the id_token email claim (no extra network
 * call); falls back to the OpenID userinfo endpoint if the id_token is unavailable.
 */
export async function resolveGmailAddress(
  tokens: ExchangedTokens,
): Promise<string> {
  const fromIdToken = emailFromIdToken(tokens.idToken);
  if (fromIdToken) return fromIdToken;

  try {
    const client = createOAuthClient();
    client.setCredentials({ access_token: tokens.accessToken });
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();
    return data.email ?? "";
  } catch {
    return "";
  }
}

/**
 * Build an authenticated Gmail client from a stored refresh token. googleapis
 * transparently refreshes the access token when needed.
 */
export function gmailClientFromRefreshToken(refreshToken: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return { gmail: google.gmail({ version: "v1", auth: client }), auth: client };
}
