import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildQueryString, type CatalogParams } from "@/lib/catalog/params";
import { cn } from "@/lib/utils";

/** URL-driven pagination. Every page is a shareable link. */
export function Pagination({
  params,
  totalPages,
  basePath,
}: {
  params: CatalogParams;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;

  const current = Math.min(params.page, totalPages);
  const href = (p: number) => `${basePath}${buildQueryString(params, { page: p })}`;

  // Window of page numbers around the current page.
  const windowSize = 5;
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const base = "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm";

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      {current > 1 ? (
        <Link href={href(current - 1)} className={cn(base, "border-border hover:bg-muted")}>
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={cn(base, "border-border text-muted-foreground opacity-50")}>
          <ChevronLeft className="size-4" />
        </span>
      )}

      {start > 1 && (
        <>
          <Link href={href(1)} className={cn(base, "border-border hover:bg-muted")}>
            1
          </Link>
          {start > 2 && <span className="text-muted-foreground px-1">…</span>}
        </>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === current ? "page" : undefined}
          className={cn(
            base,
            p === current
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted",
          )}
        >
          {p}
        </Link>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-muted-foreground px-1">…</span>}
          <Link href={href(totalPages)} className={cn(base, "border-border hover:bg-muted")}>
            {totalPages}
          </Link>
        </>
      )}

      {current < totalPages ? (
        <Link href={href(current + 1)} className={cn(base, "border-border hover:bg-muted")}>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(base, "border-border text-muted-foreground opacity-50")}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
