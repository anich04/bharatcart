"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCouponAction, toggleCouponAction } from "@/lib/actions/admin-coupons";
import { formatPaise } from "@/lib/money";

const input = "border-input bg-background h-9 w-full rounded-md border px-3 text-sm outline-none";
const label = "mb-1 block text-xs font-medium";

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENT" | "FLAT";
  value: number;
  minOrderValue: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
};

type FormState = {
  id?: string | null;
  code: string;
  description: string;
  type: "PERCENT" | "FLAT";
  value: number;
  minOrderValueRupees: number;
  maxDiscountRupees: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

const blank: FormState = {
  code: "",
  description: "",
  type: "PERCENT",
  value: 10,
  minOrderValueRupees: 0,
  maxDiscountRupees: null,
  usageLimit: null,
  perUserLimit: null,
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

function describe(c: CouponRow) {
  const amount = c.type === "PERCENT" ? `${c.value / 100}% off` : `${formatPaise(c.value)} off`;
  const min = c.minOrderValue > 0 ? ` over ${formatPaise(c.minOrderValue)}` : "";
  const cap = c.maxDiscount ? ` (max ${formatPaise(c.maxDiscount)})` : "";
  return `${amount}${min}${cap}`;
}

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  const save = () =>
    startTransition(async () => {
      if (!form) return;
      setMsg(null);
      const res = await saveCouponAction({
        ...form,
        description: form.description || null,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
      });
      if (res.ok) {
        setForm(null);
        setMsg({ type: "ok", text: "Coupon saved." });
        router.refresh();
      } else {
        setMsg({ type: "err", text: res.error ?? "Save failed" });
      }
    });

  const toggle = (id: string, isActive: boolean) =>
    startTransition(async () => {
      await toggleCouponAction(id, isActive);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {msg && (
        <p
          className={
            msg.type === "ok"
              ? "rounded-md bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-500"
              : "bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
          }
        >
          {msg.text}
        </p>
      )}

      {!form && (
        <button
          onClick={() => setForm(blank)}
          className="bg-primary text-primary-foreground w-fit rounded-md px-3 py-1.5 text-sm font-medium"
        >
          + New coupon
        </button>
      )}

      {form && (
        <div className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
          <div>
            <label className={label}>Code</label>
            <input
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Type</label>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as "PERCENT" | "FLAT")}
              className={input}
            >
              <option value="PERCENT">Percentage</option>
              <option value="FLAT">Flat amount</option>
            </select>
          </div>
          <div>
            <label className={label}>
              {form.type === "PERCENT" ? "Percent (%)" : "Amount (₹)"}
            </label>
            <input
              type="number"
              min={0}
              value={form.value}
              onChange={(e) => set("value", Number(e.target.value))}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Min order (₹)</label>
            <input
              type="number"
              min={0}
              value={form.minOrderValueRupees}
              onChange={(e) => set("minOrderValueRupees", Number(e.target.value))}
              className={input}
            />
          </div>
          {form.type === "PERCENT" && (
            <div>
              <label className={label}>Max discount (₹)</label>
              <input
                type="number"
                min={0}
                value={form.maxDiscountRupees ?? ""}
                onChange={(e) =>
                  set("maxDiscountRupees", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="No cap"
                className={input}
              />
            </div>
          )}
          <div>
            <label className={label}>Total uses</label>
            <input
              type="number"
              min={1}
              value={form.usageLimit ?? ""}
              onChange={(e) =>
                set("usageLimit", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Unlimited"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Uses per customer</label>
            <input
              type="number"
              min={1}
              value={form.perUserLimit ?? ""}
              onChange={(e) =>
                set("perUserLimit", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Unlimited"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Starts</label>
            <input
              type="date"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Expires</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
              className={input}
            />
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Description (internal)</label>
            <input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={input}
            />
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <button
              onClick={save}
              disabled={pending}
              className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save coupon"}
            </button>
            <button
              onClick={() => setForm(null)}
              className="border-input hover:bg-muted h-9 rounded-md border px-4 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border-border divide-border divide-y rounded-lg border">
        {coupons.length === 0 && (
          <p className="text-muted-foreground p-6 text-center text-sm">No coupons yet.</p>
        )}
        {coupons.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {c.code} <span className="text-muted-foreground font-normal">— {describe(c)}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                Used {c.usedCount}
                {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                {c.perUserLimit ? ` · ${c.perUserLimit} per customer` : ""}
                {c.expiresAt ? ` · expires ${c.expiresAt.toLocaleDateString("en-IN")}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={
                  c.isActive
                    ? "rounded-full bg-green-600/10 px-2 py-0.5 text-xs text-green-700 dark:text-green-500"
                    : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
                }
              >
                {c.isActive ? "Active" : "Inactive"}
              </span>
              <button
                onClick={() => toggle(c.id, !c.isActive)}
                className="text-primary text-xs hover:underline"
              >
                {c.isActive ? "Disable" : "Enable"}
              </button>
              <button
                onClick={() =>
                  setForm({
                    id: c.id,
                    code: c.code,
                    description: c.description ?? "",
                    type: c.type,
                    value: c.type === "PERCENT" ? c.value / 100 : c.value / 100,
                    minOrderValueRupees: c.minOrderValue / 100,
                    maxDiscountRupees: c.maxDiscount ? c.maxDiscount / 100 : null,
                    usageLimit: c.usageLimit,
                    perUserLimit: c.perUserLimit,
                    startsAt: c.startsAt ? c.startsAt.toISOString().slice(0, 10) : "",
                    expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : "",
                    isActive: c.isActive,
                  })
                }
                className="text-primary text-xs hover:underline"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
