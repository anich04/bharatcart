import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignupForm } from "@/components/auth/forms";
import { googleSignInAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="flex flex-col gap-4">
      <SignupForm />
      {googleEnabled && (
        <>
          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <span className="bg-border h-px flex-1" />
          </div>
          <form action={googleSignInAction}>
            <button
              type="submit"
              className="border-input hover:bg-muted h-10 w-full rounded-md border text-sm font-medium"
            >
              Continue with Google
            </button>
          </form>
        </>
      )}
    </div>
  );
}
