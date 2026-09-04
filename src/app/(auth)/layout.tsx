import Link from "next/link";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "BharatCart";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2">
        <span className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold">
          B
        </span>
        <span className="text-xl font-semibold tracking-tight">{storeName}</span>
      </Link>
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">{children}</div>
    </div>
  );
}
