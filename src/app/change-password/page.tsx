"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FullPageSpinner } from "@/components/route-guard";
import { homeForRole, useAuth } from "@/components/auth-provider";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

const RULES = [
  { label: "At least 12 characters", test: (p: string) => p.length >= 12 },
  { label: "Upper and lower case letters", test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { label: "At least one digit", test: (p: string) => /\d/.test(p) },
  { label: "At least one symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function ChangePasswordPage() {
  const { status, user, refreshUser } = useAuth();
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const forced = user?.must_change_password ?? false;

  // Guests go to login; users without the pending flag go to their workspace.
  useEffect(() => {
    if (status === "guest") router.replace("/login");
    if (status === "authenticated" && user && !user.must_change_password) {
      // Direct visits are allowed (voluntary change) — no redirect.
    }
  }, [status, user, router]);

  if (status !== "authenticated" || !user) {
    return <FullPageSpinner label="Checking your session…" />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword({
        current_password: current,
        new_password: next,
        confirm_password: confirm,
      });
      await refreshUser(); // clears must_change_password
      router.replace(homeForRole(user.roles));
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
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Image
            src="/images/logo.jpeg"
            alt="KM Media Training Institute logo"
            width={56}
            height={56}
            priority
            className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-white object-contain shadow-sm ring-1 ring-brand-100"
          />
          <h1 className="text-xl font-semibold text-ink-900">
            {forced ? "Set your new password" : "Change your password"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {forced
              ? "For security, you must replace your temporary password before continuing."
              : "Choose a strong password you have not used recently."}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="current" className="block text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              id="current"
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label htmlFor="new" className="block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="new"
              type="password"
              required
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <ul className="mt-2 space-y-1">
              {RULES.map((rule) => (
                <li
                  key={rule.label}
                  className={`text-xs ${rule.test(next) ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {rule.test(next) ? "✓" : "•"} {rule.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
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
            {busy ? "Saving…" : "Save new password"}
          </button>

          {!forced && (
            <button
              type="button"
              onClick={() => router.replace(homeForRole(user.roles))}
              className="w-full text-center text-xs text-slate-500 underline hover:text-brand-700"
            >
              Cancel and go back
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
