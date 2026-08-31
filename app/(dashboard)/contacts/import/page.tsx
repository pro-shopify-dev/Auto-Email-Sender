"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import type { ContactInput } from "@/models/contact";

interface ParsedRow {
  row: number;
  data: ContactInput | null;
  errors: string[];
}
interface ParseResult {
  rows: ParsedRow[];
  validCount: number;
  invalidCount: number;
  detectedColumns: string[];
  fileColumns: string[];
  unrecognizedColumns: string[];
  emailColumnFound: boolean;
}

export default function ImportPage() {
  const router = useRouter();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [committing, setCommitting] = useState(false);

  /**
   * Read a spreadsheet file into CSV text. Detects Excel by its magic bytes (not the file
   * name — Shopify exports are sometimes an .xlsx saved with a .csv extension). Excel files
   * are zip archives starting with "PK"; legacy .xls are OLE files starting with 0xD0CF.
   */
  async function fileToCsv(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK" -> xlsx
    const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf; // legacy .xls
    const isExcelExt = /\.(xlsx|xls)$/i.test(file.name);

    if (isZip || isOle || isExcelExt) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(bytes, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
      if (!sheet) return "";
      return XLSX.utils.sheet_to_csv(sheet);
    }

    // Plain CSV — decode the bytes as UTF-8 text.
    return new TextDecoder().decode(bytes);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await fileToCsv(file);
      const res = await apiFetch<ParseResult>("/api/import?mode=preview", {
        method: "POST",
        body: JSON.stringify({ csv: text }),
      });
      setResult(res);
      if (res.validCount === 0) {
        toast.error("No valid rows found", "Check the required columns (firstName, email).");
      }
    } catch (err) {
      toast.error("Could not parse CSV", (err as Error).message);
    }
  }

  async function commit() {
    if (!result) return;
    const contacts = result.rows.filter((r) => r.data).map((r) => r.data);
    setCommitting(true);
    try {
      const res = await apiFetch<{ inserted: number; updated: number; skipped: number }>(
        "/api/import?mode=commit",
        { method: "POST", body: JSON.stringify({ contacts }) },
      );
      toast.success(
        "Import complete",
        `${res.inserted} added, ${res.updated} updated, ${res.skipped} skipped.`,
      );
      router.push("/contacts");
    } catch (err) {
      toast.error("Import failed", (err as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Import contacts"
        description="Upload a CSV or Excel (.xlsx) file. We import contact info only: name, email, phone, and address. Email is required; everything else is optional. Other columns (company, tags, subscription, etc.) are ignored."
      />

      {!result && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <UploadCloud className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-medium">Choose a CSV or Excel file to preview</p>
              <p className="text-sm text-muted-foreground">
                Nothing is imported until you confirm.
              </p>
            </div>
            <label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={onFile}
              />
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Select file
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> {result.validCount} valid
            </Badge>
            {result.invalidCount > 0 && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {result.invalidCount} invalid
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">from {fileName}</span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setResult(null)}>
                Choose another
              </Button>
              <Button onClick={commit} disabled={committing || result.validCount === 0}>
                {committing ? "Importing…" : `Import ${result.validCount} contacts`}
              </Button>
            </div>
          </div>

          {/* Column diagnostics — makes header mismatches obvious. */}
          <Card>
            <CardContent className="space-y-2 py-4 text-sm">
              {!result.emailColumnFound && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      No email column detected — that’s why every row is invalid.
                    </p>
                    <p className="text-muted-foreground">
                      Rename your email column to include the word “email”, or tell me which
                      of the columns below holds the email address.
                    </p>
                  </div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Columns found in your file: </span>
                {result.fileColumns.length === 0 ? (
                  <span className="text-muted-foreground">none</span>
                ) : (
                  <span className="inline-flex flex-wrap gap-1 align-middle">
                    {result.fileColumns.map((c) => (
                      <Badge
                        key={c}
                        variant={
                          result.unrecognizedColumns.includes(c) ? "secondary" : "success"
                        }
                      >
                        {c}
                      </Badge>
                    ))}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Green = recognized and imported · Grey = ignored (not a contact field).
              </p>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.slice(0, 200).map((r) => (
                  <TableRow key={r.row}>
                    <TableCell className="text-muted-foreground">{r.row}</TableCell>
                    <TableCell>
                      {r.data
                        ? `${r.data.firstName ?? ""} ${r.data.lastName ?? ""}`.trim() || "—"
                        : "—"}
                    </TableCell>
                    <TableCell>{r.data?.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.data?.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.data?.address || r.data?.city || "—"}
                    </TableCell>
                    <TableCell>
                      {r.data ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <span
                          className="text-xs text-destructive"
                          title={r.errors.join(", ")}
                        >
                          {r.errors[0] ?? "Invalid"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {result.rows.length > 200 && (
            <p className="text-sm text-muted-foreground">
              Showing first 200 rows of {result.rows.length}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
