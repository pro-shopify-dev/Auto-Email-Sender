import { describe, it, expect } from "vitest";
import { render, extractVariables, contactVariables } from "@/lib/template";

describe("template engine", () => {
  it("renders variables from a normalized map", () => {
    const out = render("Hi {{firstname}} at {{company}}", {
      firstname: "Alex",
      company: "Acme",
    });
    expect(out).toBe("Hi Alex at Acme");
  });

  it("matches {{first name}}, {{First Name}}, {{first_name}} and {{name}} to the first name", () => {
    const vars = contactVariables({ firstName: "Sam" });
    expect(render("Hi {{first name}}", vars)).toBe("Hi Sam");
    expect(render("Hi {{First Name}}", vars)).toBe("Hi Sam");
    expect(render("Hi {{first_name}}", vars)).toBe("Hi Sam");
    expect(render("Hi {{name}}", vars)).toBe("Hi Sam");
  });

  it("falls back to 'there' when the contact has no first name", () => {
    const vars = contactVariables({ email: "a@example.com" });
    expect(render("Hi {{first name}},", vars)).toBe("Hi there,");
    expect(render("Hello {{name}}!", vars)).toBe("Hello there!");
  });

  it("supports a custom name fallback", () => {
    const vars = contactVariables({}, "friend");
    expect(render("Hey {{firstName}}", vars)).toBe("Hey friend");
  });

  it("renders unknown variables as empty string (no token leak)", () => {
    expect(render("Hello {{unknownField}}!", {})).toBe("Hello !");
  });

  it("extracts the unique set of normalized variable names", () => {
    const vars = extractVariables(
      "Hi {{first name}}",
      "<p>{{firstName}} from {{company}}</p>",
    );
    expect(vars.sort()).toEqual(["company", "firstname"]);
  });

  it("exposes contact fields (email, phone, address) as variables", () => {
    const vars = contactVariables({
      firstName: "Jo",
      email: "jo@example.com",
      phone: "555",
      address: "1 Main St",
    });
    expect(render("{{email}} / {{phone}} / {{address}}", vars)).toBe(
      "jo@example.com / 555 / 1 Main St",
    );
  });
});
