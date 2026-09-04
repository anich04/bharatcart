/** Loading placeholders that mirror the real layout to avoid layout shift. */

export function ProductCardSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="bg-muted aspect-square animate-pulse" />
      <div className="flex flex-col gap-2 p-3">
        <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
        <div className="bg-muted h-4 w-full animate-pulse rounded" />
        <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
        <div className="bg-muted mt-1 h-4 w-1/2 animate-pulse rounded" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="bg-muted mb-3 h-4 w-40 animate-pulse rounded" />
      <div className="bg-muted mb-5 h-7 w-56 animate-pulse rounded" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="hidden w-56 shrink-0 flex-col gap-3 lg:flex">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-24 animate-pulse rounded" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <ProductGridSkeleton />
        </div>
      </div>
    </div>
  );
}
