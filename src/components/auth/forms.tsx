"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  loginAction,
  signupAction,
  requestPasswordResetAction,
  resetPasswordAction,
  type ActionState,
} from "@/lib/actions/auth";

const initial: ActionState = {};

const inputCls =
  "border-input bg-background focus:ring-ring h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-2";
const btnCls =
  "bg-primary text-primary-foreground h-10 w-full rounded-md text-sm font-medium disabled:opacity-60";

function Error({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{msg}</p>;
}

function Success({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="rounded-md bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-500">
      {msg}
    </p>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <Error msg={state.error} />
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
      <input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
        className={inputCls}
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        required
        className={inputCls}
      />
      <div className="text-right">
        <Link href="/forgot-password" className="text-primary text-xs hover:underline">
          Forgot password?
        </Link>
      </div>
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-muted-foreground text-center text-sm">
        New here?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <Error msg={state.error} />
      <input
        name="name"
        type="text"
        placeholder="Full name"
        autoComplete="name"
        required
        className={inputCls}
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
        className={inputCls}
      />
      <input
        name="password"
        type="password"
        placeholder="Password (min 8 characters)"
        autoComplete="new-password"
        required
        minLength={8}
        className={inputCls}
      />
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <Error msg={state.error} />
      <Success msg={state.success ? state.message : undefined} />
      <p className="text-muted-foreground text-sm">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
        className={inputCls}
      />
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Set a new password</h1>
      <Error msg={state.error} />
      <Success msg={state.success ? state.message : undefined} />
      <input type="hidden" name="token" value={token} />
      {!state.success && (
        <>
          <input
            name="password"
            type="password"
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputCls}
          />
          <button type="submit" disabled={pending} className={btnCls}>
            {pending ? "Updating…" : "Update password"}
          </button>
        </>
      )}
      {state.success && (
        <Link href="/login" className={btnCls + " flex items-center justify-center"}>
          Go to sign in
        </Link>
      )}
    </form>
  );
}
