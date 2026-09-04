"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <AlertTriangle className="text-destructive size-14" />
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        We hit an unexpected error. Nothing was charged. Please try again.
      </p>
      {error.digest && <p className="text-muted-foreground text-xs">Reference: {error.digest}</p>}
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border-input hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
