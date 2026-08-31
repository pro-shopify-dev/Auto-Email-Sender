import { describe, it, expect } from "vitest";
import { parseContactsCsv } from "@/lib/csv";

describe("CSV import parsing", () => {
  it("maps aliased contact-info headers and validates rows", () => {
    const csv = [
      "First Name,Last Name,Email,Phone",
      "Alex,Rivera,alex@example.com,555-1000",
      "Sam,Lee,sam@example.com,",
    ].join("\n");

    const result = parseContactsCsv(csv);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
    expect(result.rows[0]!.data?.firstName).toBe("Alex");
    expect(result.rows[0]!.data?.lastName).toBe("Rivera");
    expect(result.rows[0]!.data?.phone).toBe("555-1000");
    expect(result.detectedColumns).toContain("email");
  });

  it("flags rows with a missing/invalid email", () => {
    const csv = ["firstName,email", "NoEmail,", "Bad,not-an-email"].join("\n");
    const result = parseContactsCsv(csv);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(2);
    expect(result.rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it("reports the source row number (accounting for the header)", () => {
    const csv = ["firstName,email", "A,a@example.com"].join("\n");
    const result = parseContactsCsv(csv);
    expect(result.rows[0]!.row).toBe(2);
  });

  it("blanks the placeholder store name 'Zabitat' but keeps the row (email present)", () => {
    const csv = [
      "Name,Email,Phone",
      "Zabitat,store@example.com,555-1000",
      "zabitat,store2@example.com,555-1001",
      "Real Person,person@example.com,555-1002",
    ].join("\n");
    const result = parseContactsCsv(csv);
    expect(result.validCount).toBe(3);
    expect(result.rows[0]!.data?.firstName).toBe(""); // "Zabitat" -> blank
    expect(result.rows[1]!.data?.firstName).toBe(""); // case-insensitive
    expect(result.rows[2]!.data?.firstName).toBe("Real Person");
  });

  it("accepts a row with only an email (name optional)", () => {
    const csv = ["Email,Phone", "only@example.com,555"].join("\n");
    const result = parseContactsCsv(csv);
    expect(result.validCount).toBe(1);
    expect(result.rows[0]!.data?.firstName).toBe("");
    expect(result.rows[0]!.data?.email).toBe("only@example.com");
  });

  it("imports contact info only — ignores company, tags, and subscription columns", () => {
    const csv = [
      "Name,Email,Phone,Company,Tags,Subscription",
      "A,a@example.com,555,Acme Inc,vip;lead,UNSUBSCRIBED",
    ].join("\n");
    const result = parseContactsCsv(csv);
    const row = result.rows[0]!.data!;
    expect(row.email).toBe("a@example.com");
    expect(row.phone).toBe("555");
    expect(row.company).toBe(""); // company not imported
    expect(row.tags).toEqual([]); // tags not imported
    expect(row.emailStatus).toBe("active"); // subscription not imported
    expect(result.unrecognizedColumns).toEqual(
      expect.arrayContaining(["company", "tags", "subscription"]),
    );
  });

  it("does not let a blank column wipe a value from another column mapping to the same field", () => {
    // Both "location" and "address" map to address; the blank address must not erase location.
    const csv = ["Email,Location,Address", "a@example.com,ST CHARLES MO,"].join("\n");
    const result = parseContactsCsv(csv);
    expect(result.rows[0]!.data?.address).toBe("ST CHARLES MO");
  });

  it("reports fuzzy header diagnostics (fileColumns / emailColumnFound)", () => {
    const csv = ["id,name,Customer Email,phone", "1,Jo,jo@example.com,555"].join("\n");
    const result = parseContactsCsv(csv);
    expect(result.emailColumnFound).toBe(true);
    expect(result.fileColumns).toContain("id");
    expect(result.unrecognizedColumns).toContain("id");
  });

  it("maps Shopify-style address/phone columns", () => {
    const csv = [
      "Name,Email,Default Address City,Default Address Country,Default Address Phone",
      "Sam,sam@example.com,Austin,USA,555-2000",
    ].join("\n");
    const result = parseContactsCsv(csv);
    expect(result.rows[0]!.data?.city).toBe("Austin");
    expect(result.rows[0]!.data?.country).toBe("USA");
    expect(result.rows[0]!.data?.phone).toBe("555-2000");
  });
});
