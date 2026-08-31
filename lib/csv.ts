import Papa from "papaparse";
import { contactInputSchema, type ContactInput } from "@/models/contact";

/**
 * Header aliases → canonical contact field. We import CONTACT INFO ONLY:
 * name, email, phone, and address (street/city/state/zip/country). Columns like company,
 * tags, notes, and subscription/marketing are intentionally ignored.
 */
const HEADER_MAP: Record<string, keyof ContactInput> = {
  firstname: "firstName",
  "first name": "firstName",
  first: "firstName",
  name: "firstName",
  "customer name": "firstName",
  "full name": "firstName",
  lastname: "lastName",
  "last name": "lastName",
  last: "lastName",
  email: "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  "default address phone": "phone",
  address: "address",
  street: "address",
  location: "address",
  "default address address1": "address",
  "default address address2": "address",
  city: "city",
  "default address city": "city",
  state: "state",
  province: "state",
  "default address province": "state",
  "default address province code": "state",
  zip: "zipCode",
  zipcode: "zipCode",
  "zip code": "zipCode",
  postal: "zipCode",
  "default address zip": "zipCode",
  country: "country",
  "default address country": "country",
  "default address country code": "country",
};

/**
 * Names that are placeholders/store names, not real people. When a mapped name field
 * matches one of these (case-insensitive), it is saved as blank instead of the literal
 * value. Add more here as needed.
 */
const PLACEHOLDER_NAMES = new Set(["zabitat"]);

function stripPlaceholderName(value: unknown): string {
  const str = typeof value === "string" ? value.trim() : "";
  return PLACEHOLDER_NAMES.has(str.toLowerCase()) ? "" : str;
}

/**
 * Resolve a file column header to a contact field. Tries an exact alias first, then a
 * fuzzy "contains" fallback so real-world headers ("Customer Email", "Billing Phone",
 * "Shipping City", …) still map. Only contact-info fields are recognized. Order matters:
 * specific location fields are checked before the generic "address" catch.
 */
function resolveField(header: string): keyof ContactInput | undefined {
  const h = header.trim().toLowerCase();
  if (!h) return undefined;

  const exact = HEADER_MAP[h];
  if (exact) return exact;

  if (h.includes("email") || h.includes("e-mail")) return "email";
  if (h.includes("first") && h.includes("name")) return "firstName";
  if (h.includes("last") && h.includes("name")) return "lastName";
  if (h.includes("phone") || h.includes("mobile") || h.includes("tel")) return "phone";
  if (h.includes("city") || h.includes("town")) return "city";
  if (h.includes("country")) return "country";
  if (h.includes("province") || h.includes("state") || h.includes("region")) return "state";
  if (h.includes("zip") || h.includes("postal") || h.includes("postcode")) return "zipCode";
  if (h.includes("address") || h.includes("street") || h.includes("location")) return "address";
  if (h === "name" || h.includes("full name") || h.includes("customer name") || h.includes("contact name"))
    return "firstName";

  return undefined;
}

export interface ParsedRow {
  row: number;
  data: ContactInput | null;
  errors: string[];
  raw: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedRow[];
  validCount: number;
  invalidCount: number;
  /** Canonical contact fields we successfully mapped (e.g. "email", "firstName"). */
  detectedColumns: string[];
  /** All column headers found in the file, as they appear (normalized to lowercase). */
  fileColumns: string[];
  /** File columns we could not map to any contact field. */
  unrecognizedColumns: string[];
  /** True when no column mapped to email — the usual cause of an all-invalid import. */
  emailColumnFound: boolean;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

/** Parse CSV text into validated contact rows with per-row errors for preview. */
export function parseContactsCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeHeader(h),
  });

  const detected = new Set<string>();
  const rows: ParsedRow[] = [];
  let validCount = 0;

  parsed.data.forEach((rawRow, index) => {
    const mapped: Record<string, unknown> = {};
    const raw: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawRow)) {
      raw[key] = value;
      const field = resolveField(key);
      if (!field) continue;
      detected.add(field);
      if (field === "firstName" || field === "lastName") {
        // Blank out placeholder/store names (e.g. "Zabitat") so they aren't saved.
        mapped[field] = stripPlaceholderName(value);
      } else {
        // Non-destructive: a later blank column (e.g. empty "address") must not wipe a
        // value already set by another column that maps to the same field (e.g. "location").
        const incoming = typeof value === "string" ? value.trim() : value;
        const existing = mapped[field];
        if (incoming !== "" && incoming != null) {
          mapped[field] = incoming;
        } else if (existing == null) {
          mapped[field] = "";
        }
      }
    }

    const result = contactInputSchema.safeParse(mapped);
    if (result.success) {
      validCount += 1;
      rows.push({ row: index + 2, data: result.data, errors: [], raw });
    } else {
      rows.push({
        row: index + 2,
        data: null,
        errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        raw,
      });
    }
  });

  const fileColumns = (parsed.meta.fields ?? []).filter(Boolean);
  const unrecognizedColumns = fileColumns.filter((c) => !resolveField(c));

  return {
    rows,
    validCount,
    invalidCount: rows.length - validCount,
    detectedColumns: [...detected],
    fileColumns,
    unrecognizedColumns,
    emailColumnFound: detected.has("email"),
  };
}
