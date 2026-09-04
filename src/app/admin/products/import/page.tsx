"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { importProductsCsvAction, type ImportResult } from "@/lib/actions/admin-import";
import { CSV_TEMPLATE_HEADERS } from "@/lib/csv";

const SAMPLE = `${CSV_TEMPLATE_HEADERS.join(",")}
Kosha Cotton Shirt,kosha-cotton-shirt,A breathable cotton shirt,mens-clothing,kosha,KSH-SHIRT-01,999,1499,25,FIVE,6205,ACTIVE`;

export default function ImportProductsPage() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setCsv(await file.text());
  };

  const run = () =>
    startTransition(async () => {
      setResult(null);
      setResult(await importProductsCsvAction(csv));
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bulk import products</h2>
        <Link href="/admin/products" className="text-primary text-sm hover:underline">
          ← Products
        </Link>
      </div>

      <div className="border-border rounded-lg border p-4 text-sm">
        <p className="font-medium">How it works</p>
        <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>
            Required columns:{" "}
            <code>title, slug, description, category, sku, price, mrp, stock</code>
          </li>
          <li>
            Optional: <code>brand, gstRate, hsnCode, status</code>
          </li>
          <li>
            <code>category</code> and <code>brand</code> are the <em>slugs</em> that already exist.
          </li>
          <li>Prices are in ₹ (rupees) and are GST-inclusive. Each row creates one variant.</li>
          <li>
            Rows are matched on <code>slug</code>, so re-importing updates instead of duplicating.
          </li>
        </ul>
        <button
          onClick={() => setCsv(SAMPLE)}
          className="text-primary mt-3 text-xs hover:underline"
        >
          Load a sample row
        </button>
      </div>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="text-sm"
      />

      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={12}
        placeholder="Paste CSV content here, or choose a file above"
        className="border-input bg-background w-full rounded-md border p-3 font-mono text-xs"
      />

      <button
        onClick={run}
        disabled={pending || csv.trim() === ""}
        className="bg-primary text-primary-foreground h-10 w-fit rounded-md px-5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import"}
      </button>

      {result && (
        <div className="border-border rounded-lg border p-4 text-sm">
          {result.error ? (
            <p className="text-destructive">{result.error}</p>
          ) : (
            <>
              <p className="font-medium">
                Imported: {result.created} created, {result.updated} updated,{" "}
                {result.skipped.length} skipped
              </p>
              {result.skipped.length > 0 && (
                <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
