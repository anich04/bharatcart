"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVariantStockAction } from "@/lib/actions/admin-products";

export function StockEditor({ variantId, stock }: { variantId: string; stock: number }) {
  const router = useRouter();
  const [value, setValue] = useState(stock);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () =>
    startTransition(async () => {
      const res = await updateVariantStockAction(variantId, value);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="border-input bg-background h-8 w-20 rounded-md border px-2 text-sm"
      />
      <button
        onClick={save}
        disabled={pending || value === stock}
        className="border-input hover:bg-muted h-8 rounded-md border px-2 text-xs disabled:opacity-40"
      >
        {saved ? "Saved" : pending ? "…" : "Save"}
      </button>
    </div>
  );
}
