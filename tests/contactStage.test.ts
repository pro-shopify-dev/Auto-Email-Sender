import { describe, it, expect } from "vitest";
import { contactStage } from "@/models/contact";

const NOW = new Date();

describe("contactStage", () => {
  it("is fresh when never touched", () => {
    expect(contactStage({ emailStatus: "active" })).toBe("fresh");
    expect(
      contactStage({ emailStatus: "active", lastEmailedAt: null, repliedAt: null }),
    ).toBe("fresh");
  });

  it("is in_draft while a draft holds the contact", () => {
    expect(contactStage({ emailStatus: "active", draftReservedAt: NOW })).toBe("in_draft");
  });

  it("is sent once emailed, even if still flagged reserved", () => {
    expect(
      contactStage({ emailStatus: "active", lastEmailedAt: NOW, draftReservedAt: NOW }),
    ).toBe("sent");
  });

  it("prefers replied over sent", () => {
    expect(
      contactStage({ emailStatus: "active", lastEmailedAt: NOW, repliedAt: NOW }),
    ).toBe("replied");
  });

  it("lets bounced and unsubscribed outrank everything", () => {
    expect(contactStage({ emailStatus: "bounced", repliedAt: NOW })).toBe("bounced");
    expect(
      contactStage({ emailStatus: "unsubscribed", lastEmailedAt: NOW }),
    ).toBe("unsubscribed");
  });

  it("accepts serialized (string) dates", () => {
    expect(
      contactStage({ emailStatus: "active", lastEmailedAt: NOW.toISOString() }),
    ).toBe("sent");
  });
});
