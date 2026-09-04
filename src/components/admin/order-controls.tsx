"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import {
  updateOrderStatusAction,
  setTrackingAction,
  refundOrderAction,
} from "@/lib/actions/admin-orders";
import { formatPaise } from "@/lib/money";

const input = "border-input bg-background h-9 w-full rounded-md border px-3 text-sm outline-none";

export function OrderControls({
  orderId,
  status,
  nextStatuses,
  carrier,
  trackingNumber,
  canRefund,
  grandTotal,
}: {
  orderId: string;
  status: OrderStatus;
  nextStatuses: OrderStatus[];
  carrier: string | null;
  trackingNumber: string | null;
  canRefund: boolean;
  grandTotal: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [next, setNext] = useState<OrderStatus | "">(nextStatuses[0] ?? "");
  const [carrierVal, setCarrierVal] = useState(carrier ?? "");
  const [trackingVal, setTrackingVal] = useState(trackingNumber ?? "");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    startTransition(async () => {
      setMsg(null);
      const res = await fn();
      setMsg(res.ok ? { type: "ok", text: okText } : { type: "err", text: res.error ?? "Failed" });
      if (res.ok) router.refresh();
    });

  return (
    <div className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Manage order</h3>

      {msg && (
        <p
          className={
            msg.type === "ok"
              ? "rounded-md bg-green-600/10 px-3 py-2 text-xs text-green-700 dark:text-green-500"
              : "bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs"
          }
        >
          {msg.text}
        </p>
      )}

      {/* Status */}
      <div>
        <label className="mb-1 block text-xs font-medium">Status (currently {status})</label>
        {nextStatuses.length === 0 ? (
          <p className="text-muted-foreground text-xs">This order is in a final state.</p>
        ) : (
          <div className="flex gap-2">
            <select
              value={next}
              onChange={(e) => setNext(e.target.value as OrderStatus)}
              className={input}
            >
              {nextStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              disabled={pending || !next}
              onClick={() =>
                run(
                  () => updateOrderStatusAction({ orderId, status: next as OrderStatus }),
                  `Status updated to ${next}.`,
                )
              }
              className="bg-primary text-primary-foreground h-9 shrink-0 rounded-md px-3 text-sm disabled:opacity-60"
            >
              Update
            </button>
          </div>
        )}
        <p className="text-muted-foreground mt-1 text-[11px]">
          Marking SHIPPED emails the customer the tracking number. Cancelling or returning restores
          stock.
        </p>
      </div>

      {/* Tracking */}
      <div>
        <label className="mb-1 block text-xs font-medium">Tracking</label>
        <div className="flex flex-col gap-2">
          <input
            value={carrierVal}
            onChange={(e) => setCarrierVal(e.target.value)}
            placeholder="Carrier (e.g. Delhivery)"
            className={input}
          />
          <input
            value={trackingVal}
            onChange={(e) => setTrackingVal(e.target.value)}
            placeholder="Tracking number"
            className={input}
          />
          <button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  setTrackingAction({
                    orderId,
                    carrier: carrierVal,
                    trackingNumber: trackingVal,
                  }),
                "Tracking saved.",
              )
            }
            className="border-input hover:bg-muted h-9 rounded-md border text-sm disabled:opacity-60"
          >
            Save tracking
          </button>
        </div>
      </div>

      {/* Refund */}
      {canRefund && (
        <div>
          <label className="mb-1 block text-xs font-medium">Refund</label>
          <button
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  `Refund ${formatPaise(grandTotal)} to the customer? This cannot be undone.`,
                )
              )
                return;
              run(
                () => refundOrderAction({ orderId, reason: "Admin refund" }),
                "Refund requested. It will show as REFUNDED once Razorpay confirms.",
              );
            }}
            className="border-destructive text-destructive hover:bg-destructive/10 h-9 w-full rounded-md border text-sm disabled:opacity-60"
          >
            Refund {formatPaise(grandTotal)}
          </button>
        </div>
      )}
    </div>
  );
}
