"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

/** Build the list of page tokens with ellipses, e.g. [1, "…", 4, 5, 6, "…", 20]. */
function pageTokens(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const tokens: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) tokens.push("…");
  for (let p = start; p <= end; p++) tokens.push(p);
  if (end < totalPages - 1) tokens.push("…");
  tokens.push(totalPages);
  return tokens;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [goto, setGoto] = useState("");

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  function go(p: number) {
    const clamped = Math.max(1, Math.min(totalPages, p));
    onPageChange(clamped);
  }

  function submitGoto() {
    const n = Number(goto);
    if (Number.isFinite(n) && n >= 1) go(Math.floor(n));
    setGoto("");
  }

  const tokens = pageTokens(page, totalPages);

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {from}–{to} of {total}
        </span>
        {onPageSizeChange && (
          <span className="flex items-center gap-1.5">
            <span>Rows:</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 w-[72px]"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {tokens.map((t, i) =>
          t === "…" ? (
            <span key={`e${i}`} className="px-1.5 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={t}
              variant={t === page ? "default" : "outline"}
              size="icon"
              className={cn("h-8 w-8 tabular-nums", t === page && "pointer-events-none")}
              onClick={() => go(t)}
              aria-current={t === page ? "page" : undefined}
            >
              {t}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {totalPages > 1 && (
          <form
            className="ml-2 flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitGoto();
            }}
          >
            <span className="hidden sm:inline">Go to</span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={goto}
              onChange={(e) => setGoto(e.target.value)}
              placeholder={String(page)}
              className="h-8 w-16"
              aria-label="Go to page"
            />
            <Button type="submit" variant="outline" size="sm" className="h-8">
              Go
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
