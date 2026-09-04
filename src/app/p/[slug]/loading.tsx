export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="bg-muted mb-4 h-4 w-64 animate-pulse rounded" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="bg-muted aspect-square animate-pulse rounded-lg" />
        <div className="flex flex-col gap-4">
          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
          <div className="bg-muted h-8 w-3/4 animate-pulse rounded" />
          <div className="bg-muted h-10 w-40 animate-pulse rounded" />
          <div className="bg-muted h-20 w-full animate-pulse rounded" />
          <div className="bg-muted h-11 w-full animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
