import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  CONFIRMED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PACKED: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  SHIPPED: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  DELIVERED: "bg-green-600/10 text-green-700 dark:text-green-500",
  CANCELLED: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  RETURNED: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  REFUNDED: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
};

const LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STYLES[status], className)}
    >
      {LABELS[status]}
    </span>
  );
}
