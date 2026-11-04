"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FullPageSpinner } from "@/components/route-guard";
import { homeForRole, useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api/client";

const REASON_BANNERS: Record<string, string> = {
  expired: "Your session expired. Please sign in again.",
  reused:
    "Your session was revoked for security reasons (token reuse detected). Please sign in again.",
};

function LoginForm() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = params.get("next");
  const reason = params.get("reason");

  // Where to land after a successful sign-in. A forced password change always
  // wins; a captured `next` is honored only when it is not another role's
  // dashboard (a stale ?next= from a previous session must not mis-land the
  // new user — staff can still navigate to preview dashboards afterwards).
  const landingFor = (mustChange: boolean, home: string) => {
    if (mustChange) return "/change-password";
    if (next && next !== "/login") {
      const dash = next.match(/^\/dashboard\/([a-z]+)/);
      if (!dash || next === home) return next;
    }
    return home;
  };

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(landingFor(user.must_change_password, homeForRole(user.roles)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user, next, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const pair = await login(identifier.trim(), password);
      router.replace(
        landingFor(pair.must_change_password, homeForRole(pair.user.roles))
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the API running?"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/images/logo.jpeg"
            alt="KM Media Training Institute logo"
            width={64}
            height={64}
            priority
            className="mx-auto h-16 w-16 rounded-2xl bg-white object-contain shadow-sm ring-1 ring-brand-100"
          />
          <h1 className="mt-4 text-xl font-semibold text-ink-900">
            KM Media Training Institute
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to the LMS dashboard
          </p>
        </div>

        {reason && REASON_BANNERS[reason] && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              reason === "reused"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {REASON_BANNERS[reason]}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="identifier"
              className="block text-sm font-medium text-slate-700"
            >
              Email, phone, or index number
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="••••••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Forgot your password?{" "}
            <a href="/forgot-password" className="font-medium text-brand-700 underline hover:text-brand-800">
              Reset it
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageSpinner label="Loading…" />}>
      <LoginForm />
    </Suspense>
  );
}
