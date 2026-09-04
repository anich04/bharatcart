import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <SearchX className="text-muted-foreground size-14" />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground text-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-2 flex gap-3">
        <Link
          href="/"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Go home
        </Link>
        <Link
          href="/search"
          className="border-input hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
        >
          Search products
        </Link>
      </div>
    </div>
  );
}
