"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="border-input hover:bg-muted flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium print:hidden"
    >
      <Printer className="size-4" />
      Print / Save as PDF
    </button>
  );
}
