import { describe, it, expect } from "vitest";
import { buildRawEmail, htmlToText } from "@/lib/mime";

function decodeRaw(raw: string): string {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

describe("mime builder", () => {
  it("produces base64url output (no +, /, or = padding)", () => {
    const raw = buildRawEmail({
      to: ["a@example.com"],
      subject: "Hi",
      htmlBody: "<p>Hello</p>",
    });
    expect(raw).not.toMatch(/[+/=]/);
  });

  it("includes the expected headers and both body parts", () => {
    const raw = decodeRaw(
      buildRawEmail({
        from: "me@example.com",
        to: ["a@example.com", "b@example.com"],
        cc: ["c@example.com"],
        subject: "Subject line",
        htmlBody: "<p>Body</p>",
      }),
    );
    expect(raw).toContain("From: me@example.com");
    expect(raw).toContain("To: a@example.com, b@example.com");
    expect(raw).toContain("Cc: c@example.com");
    expect(raw).toContain("multipart/alternative");
    expect(raw).toContain("text/plain");
    expect(raw).toContain("text/html");
  });

  it("omits the To header when there is no recipient (template-only drafts)", () => {
    const raw = decodeRaw(
      buildRawEmail({ to: [], subject: "Draft", htmlBody: "<p>x</p>" }),
    );
    expect(raw).not.toMatch(/^To:/m);
    expect(raw).toContain("Subject: Draft");
  });

  it("RFC 2047-encodes non-ASCII subjects", () => {
    const raw = decodeRaw(
      buildRawEmail({ to: ["a@x.com"], subject: "Café ☕", htmlBody: "<p>x</p>" }),
    );
    expect(raw).toMatch(/Subject: =\?UTF-8\?B\?/);
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToText("<p>Hi&nbsp;&amp; bye</p><p>Line 2</p>")).toBe("Hi & bye\nLine 2");
  });
});
