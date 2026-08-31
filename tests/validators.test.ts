import { describe, it, expect } from "vitest";
import { contactInputSchema } from "@/models/contact";
import { registerSchema } from "@/models/user";
import { startSendingSchema } from "@/models/campaign";
import { sendEmailSchema } from "@/models/emailJob";

describe("zod validators", () => {
  it("normalizes and defaults a contact", () => {
    const parsed = contactInputSchema.parse({
      firstName: "  Alex ",
      email: "ALEX@Example.com",
    });
    expect(parsed.firstName).toBe("Alex");
    expect(parsed.email).toBe("alex@example.com");
    expect(parsed.tags).toEqual([]);
    expect(parsed.emailStatus).toBe("active");
  });

  it("rejects a contact without an email", () => {
    expect(() => contactInputSchema.parse({ firstName: "X" })).toThrow();
  });

  it("enforces a minimum password length on register", () => {
    expect(() =>
      registerSchema.parse({ name: "A", email: "a@b.com", password: "short" }),
    ).toThrow();
  });

  it("requires at least one template to start sending", () => {
    expect(() => startSendingSchema.parse({ templateIds: [] })).toThrow();
    expect(startSendingSchema.parse({ templateIds: ["t"] }).templateIds).toEqual(["t"]);
  });

  it("requires at least one recipient to send", () => {
    expect(() =>
      sendEmailSchema.parse({ to: [], subject: "s", htmlBody: "<p>b</p>" }),
    ).toThrow();
  });

  it("accepts a valid send payload with defaults", () => {
    const parsed = sendEmailSchema.parse({
      to: ["a@example.com"],
      subject: "Hi",
      htmlBody: "<p>b</p>",
    });
    expect(parsed.cc).toEqual([]);
    expect(parsed.test).toBe(false);
  });
});
