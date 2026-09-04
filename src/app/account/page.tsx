import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, AlertCircle } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileAction } from "@/lib/actions/profile";

export const metadata: Metadata = { title: "Profile" };

const input =
  "border-input bg-background focus:ring-ring h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, emailVerified: true, createdAt: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="flex max-w-lg flex-col gap-5">
      <div className="border-border rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{user.email}</p>
            <p className="text-muted-foreground text-xs">
              Member since {user.createdAt.toLocaleDateString("en-IN")}
            </p>
          </div>
          {user.emailVerified ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-500">
              <BadgeCheck className="size-4" /> Verified
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500">
              <AlertCircle className="size-4" /> Unverified
            </span>
          )}
        </div>
      </div>

      <form action={updateProfileAction} className="flex flex-col gap-3">
        <label className="text-sm font-medium">Name</label>
        <input name="name" defaultValue={user.name ?? ""} required className={input} />
        <label className="text-sm font-medium">Phone (optional)</label>
        <input
          name="phone"
          defaultValue={user.phone ?? ""}
          placeholder="10-digit mobile"
          className={input}
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-10 w-fit rounded-md px-4 text-sm font-medium"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
