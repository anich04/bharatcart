import { cn } from "@/lib/utils";
import { discountPercent, formatPaise } from "@/lib/money";

/** Price with MRP strikethrough and discount %. All inputs are paise. */
export function Price({
  price,
  mrp,
  size = "md",
  className,
}: {
  price: number;
  mrp: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = discountPercent(mrp, price);
  const priceText =
    size === "lg"
      ? "text-2xl font-semibold"
      : size === "sm"
        ? "text-sm font-semibold"
        : "text-base font-semibold";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={priceText}>{formatPaise(price)}</span>
      {pct > 0 && (
        <>
          <span className="text-muted-foreground text-sm line-through">{formatPaise(mrp)}</span>
          <span className="text-sm font-medium text-green-700 dark:text-green-500">{pct}% off</span>
        </>
      )}
    </div>
  );
}
