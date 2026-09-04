import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CouponManager } from "@/components/admin/coupon-manager";

export const metadata: Metadata = { title: "Coupons · Admin" };

export default async function CouponsPage() {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      value: true,
      minOrderValue: true,
      maxDiscount: true,
      usageLimit: true,
      perUserLimit: true,
      usedCount: true,
      startsAt: true,
      expiresAt: true,
      isActive: true,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Coupons</h2>
      <CouponManager coupons={coupons} />
    </div>
  );
}
