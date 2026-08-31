export interface OutgoingEmail {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
}

/** Encode a header value that may contain non-ASCII using RFC 2047 (UTF-8, base64). */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/**
 * Build a base64url-encoded MIME message suitable for the Gmail API
 * (`users.messages.send` `raw` field). Produces a multipart/alternative message
 * with both text and HTML parts.
 */
export function buildRawEmail(email: OutgoingEmail): string {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}`;
  const text =
    email.textBody && email.textBody.trim().length > 0
      ? email.textBody
      : htmlToText(email.htmlBody);

  const headers: string[] = [];
  if (email.from) headers.push(`From: ${email.from}`);
  // Template-only drafts have no recipient — omit the header entirely rather than "To: ".
  if (email.to.length) headers.push(`To: ${email.to.join(", ")}`);
  if (email.cc?.length) headers.push(`Cc: ${email.cc.join(", ")}`);
  if (email.bcc?.length) headers.push(`Bcc: ${email.bcc.join(", ")}`);
  headers.push(`Subject: ${encodeHeader(email.subject)}`);
  headers.push("MIME-Version: 1.0");
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const body = [
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64"),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(email.htmlBody, "utf8").toString("base64"),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const message = headers.join("\r\n") + "\r\n" + body;
  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Crude HTML→text fallback for the plaintext alternative part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
