import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating. `value` is 0..5 (may be fractional). */
export function RatingStars({
  value,
  count,
  size = 14,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2; // nearest half
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex" aria-label={`${value.toFixed(1)} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <span key={i} className="relative inline-flex">
              <Star
                size={size}
                className="text-amber-400"
                fill={filled ? "currentColor" : "none"}
              />
              {half && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                  <Star size={size} className="text-amber-400" fill="currentColor" />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {count !== undefined && (
        <span className="text-muted-foreground text-xs">
          {value.toFixed(1)}
          {count > 0 ? ` (${count})` : ""}
        </span>
      )}
    </div>
  );
}
