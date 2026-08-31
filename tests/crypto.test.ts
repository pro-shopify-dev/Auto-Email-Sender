import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto (AES-256-GCM)", () => {
  it("round-trips plaintext", () => {
    const secret = "1//refresh-token-value-abc123";
    const cipher = encrypt(secret);
    expect(cipher).not.toContain(secret);
    expect(decrypt(cipher)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("has the iv.tag.data shape", () => {
    expect(encrypt("x").split(".")).toHaveLength(3);
  });

  it("throws on a tampered payload (auth tag mismatch)", () => {
    const cipher = encrypt("tamper-me");
    const [iv, tag, data] = cipher.split(".") as [string, string, string];
    const flipped = `${iv}.${tag}.${data.slice(0, -2)}AA`;
    expect(() => decrypt(flipped)).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow();
  });
});
