"use client";

import { useState, type FormEvent } from "react";
import { ApiError, api } from "@/lib/api/client";

interface TrackResult {
  application_number: string;
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  info_request: string | null;
  info_response: string | null;
}

const STATUS_STYLES: Record<string, { chip: string; help: string }> = {
  SUBMITTED: {
    chip: "bg-blue-100 text-blue-700",
    help: "Your application has been received and is waiting for review.",
  },
  UNDER_REVIEW: {
    chip: "bg-amber-100 text-amber-800",
    help: "Our admissions office is reviewing your application.",
  },
  MORE_INFO: {
    chip: "bg-purple-100 text-purple-700",
    help: "We need more information from you before the review can continue.",
  },
  APPROVED: {
    chip: "bg-emerald-100 text-emerald-700",
    help: "Congratulations! Your admission details have been sent to your email.",
  },
  REJECTED: {
    chip: "bg-red-100 text-red-700",
    help: "This application was not successful. See the note below.",
  },
};

export default function TrackApplicationPage() {
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [reply, setReply] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyDone, setReplyDone] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setReplyDone(false);
    setBusy(true);
    try {
      const data = await api<TrackResult>("/applications/status", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          application_number: number.trim(),
          email: email.trim(),
        }),
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "No application found for that number and email combination."
          : err instanceof ApiError
            ? err.message
            : "Could not reach the server. Is the API running?"
      );
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e: FormEvent) => {
    e.preventDefault();
    setReplyError(null);
    setReplyBusy(true);
    try {
      await api("/applications/info-response", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          application_number: number.trim(),
          email: email.trim(),
          message: reply.trim(),
        }),
      });
      setReplyDone(true);
      setReply("");
      // Re-fetch so the status banner reflects UNDER_REVIEW immediately.
      const data = await api<TrackResult>("/applications/status", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ application_number: number.trim(), email: email.trim() }),
      });
      setResult(data);
    } catch (err) {
      setReplyError(err instanceof ApiError ? err.message : "Could not send your response");
    } finally {
      setReplyBusy(false);
    }
  };

  const style = result ? STATUS_STYLES[result.status] : undefined;
  const canReply = result?.status === "MORE_INFO" || (!!result?.info_request && !result?.info_response);

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            KM
          </span>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Track your application
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Use the application number from your confirmation email and the email
            address you applied with.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="app-number" className="block text-sm font-medium text-slate-700">
              Application number
            </label>
            <input
              id="app-number"
              required
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="APP/2026/00042"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label htmlFor="app-email" className="block text-sm font-medium text-slate-700">
              Email address
            </label>
            <input
              id="app-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Check status"}
          </button>
        </form>

        {result && style && (
          <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">
                {result.application_number}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.chip}`}>
                {result.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-slate-600">{style.help}</p>

            {result.decision_note && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <span className="font-medium">Note from admissions:</span>{" "}
                {result.decision_note}
              </p>
            )}

            {result.info_request && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm">
                <p className="font-medium text-purple-800">Information requested</p>
                <p className="mt-1 text-purple-700">{result.info_request}</p>
                {result.info_response && (
                  <p className="mt-2 rounded-md bg-white p-2 text-slate-700">
                    <span className="font-medium">Your reply:</span> {result.info_response}
                  </p>
                )}
              </div>
            )}

            {canReply && (
              <form onSubmit={sendReply} className="space-y-2 border-t border-slate-100 pt-4">
                <label htmlFor="reply" className="block text-sm font-medium text-slate-700">
                  Respond to admissions
                </label>
                <textarea
                  id="reply"
                  rows={3}
                  required
                  minLength={5}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your answer here…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
                {replyError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {replyError}
                  </p>
                )}
                {replyDone && (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                    Response sent — the review continues.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={replyBusy}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {replyBusy ? "Sending…" : "Send response"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
