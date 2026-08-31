/**
 * Lightweight `{{variable}}` template engine for subjects and bodies.
 *
 * - Variable names are matched loosely: `{{firstName}}`, `{{first name}}`, `{{First Name}}`,
 *   and `{{name}}` all resolve to the contact's first name. Matching is case-insensitive and
 *   ignores spaces/underscores/hyphens inside the braces.
 * - When the first name is blank, name variables render as a friendly fallback ("there"),
 *   so "Hi {{first name}}," becomes "Hi there,". Configurable via `render`'s options.
 * - Unknown variables render as an empty string (never leak the raw token).
 */

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Normalize a variable name: lowercase, strip spaces / underscores / hyphens. */
function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, "");
}

/** Extract the unique set of (normalized) variable names referenced in the sources. */
export function extractVariables(...sources: string[]): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(TOKEN_RE)) {
      const raw = match[1];
      if (raw) found.add(normalizeKey(raw));
    }
  }
  return [...found];
}

/** Render a template against a variable map keyed by normalized names. */
export function render(
  template: string,
  variables: Record<string, string | undefined>,
): string {
  return template.replace(TOKEN_RE, (_full, name: string) => {
    const value = variables[normalizeKey(name)];
    return value == null ? "" : String(value);
  });
}

export interface ContactLike {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

/**
 * Build the normalized-key variable map from a contact. Name variables fall back to
 * `nameFallback` (default "there") when the contact has no first name.
 */
export function contactVariables(
  contact: ContactLike,
  nameFallback = "there",
): Record<string, string> {
  const first = (contact.firstName ?? "").trim();
  const last = (contact.lastName ?? "").trim();
  const nameOrFallback = first || nameFallback;
  const fullName = `${first} ${last}`.trim() || nameFallback;

  return {
    // name variants -> first name (or fallback)
    firstname: nameOrFallback,
    name: nameOrFallback,
    // other fields
    lastname: last,
    fullname: fullName,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    city: contact.city ?? "",
    country: contact.country ?? "",
  };
}
