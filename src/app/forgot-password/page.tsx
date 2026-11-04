"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { authApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";

/**
 * Self-service password reset. Step 1 requests a token (delivered by email/
 * SMS; in development without providers the API returns the token in the
 * response message). Step 2 exchanges the token for a new password.
 */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const message = await authApi.requestPasswordReset(identifier.trim());
      setNotice(message);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const message = await authApi.confirmPasswordReset({
        token: token.trim(),
        new_password: next,
        confirm_password: confirm,
      });
      setNotice(`${message} You can now sign in.`);
      setStep(1);
      setIdentifier("");
      setToken("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed.");
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
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === 1
              ? "Enter the email, phone, or index number on your account."
              : "Enter the code you received and choose a new password."}
          </p>
        </div>

        {notice && (
          <p className="mb-4 whitespace-pre-wrap rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        {step === 1 ? (
          <form
            onSubmit={onRequest}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-slate-700">
                Email, phone, or index number
              </label>
              <input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
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
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset code"}
            </button>
            <p className="text-center text-xs text-slate-500">
              <a href="/login" className="font-medium text-brand-700 underline hover:text-brand-800">
                Back to sign in
              </a>
            </p>
          </form>
        ) : (
          <form
            onSubmit={onConfirm}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-slate-700">
                Reset code
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
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
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? "Resetting…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
