"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import {
  notificationsApi,
  type OutboxNotification,
  type SMSStatusResponse,
} from "@/lib/api/notifications";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SENT: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
    FAILED: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
    QUEUED: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
        styles[status.toUpperCase()] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const isSms = channel.toUpperCase() === "SMS";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
        isSms
          ? "bg-purple-50 text-purple-700 ring-1 ring-purple-700/20"
          : "bg-sky-50 text-sky-700 ring-1 ring-sky-700/20"
      }`}
    >
      {isSms ? (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
          <path d="M11 18h2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      )}
      {channel.toUpperCase()}
    </span>
  );
}

function NotificationsAdminInner() {
  const [smsStatus, setSmsStatus] = useState<SMSStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Outbox data
  const [items, setItems] = useState<OutboxNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Preview Modal
  const [activeItem, setActiveItem] = useState<OutboxNotification | null>(null);

  // Quick SMS State
  const [showQuickSms, setShowQuickSms] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await notificationsApi.getSMSStatus();
      setSmsStatus(res);
    } catch {
      // Ignored
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchOutbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.getOutbox({
        channel: channelFilter === "ALL" ? undefined : channelFilter,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: search.trim() ? search.trim() : undefined,
        limit: 50,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load notification outbox.");
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter, search]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    void fetchOutbox();
  }, [fetchOutbox]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    setActionSuccess(null);
    try {
      const updated = await notificationsApi.retryNotification(id);
      setItems((prev) => prev.map((n) => (n.id === id ? updated : n)));
      setActionSuccess("Notification retry dispatched successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err?.message ?? "Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim() || !testMessage.trim()) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await notificationsApi.sendTestSMS({
        recipient: testRecipient.trim(),
        message: testMessage.trim(),
      });
      if (res.success) {
        setTestResult({
          ok: true,
          msg: `SMS delivered via ${res.provider}! Provider Msg ID: ${res.provider_message_id ?? "sent"}`,
        });
        setTestMessage("");
        void fetchOutbox();
        void fetchStatus();
      } else {
        setTestResult({
          ok: false,
          msg: `SMS delivery failed: ${res.error_message || "Unknown provider error"}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        msg: err?.message || "Failed to dispatch test SMS.",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const smsBalance = smsStatus?.balance_info?.balance;
  const isBms = smsStatus?.provider === "bms";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Notification System &amp; SMS Gateway
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor real-time SMS and email dispatch, check BMS Africa account standing, and manage outbound delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void fetchStatus();
              void fetchOutbox();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setShowQuickSms((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
            {showQuickSms ? "Hide SMS Tester" : "Quick Send SMS"}
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800">
          {actionSuccess}
        </div>
      )}

      {/* Gateway Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* BMS Africa Card */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              SMS Gateway Provider
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isBms
                  ? "bg-emerald-100 text-emerald-800"
                  : smsStatus?.configured
                  ? "bg-blue-100 text-blue-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isBms ? "BMS Africa Active" : smsStatus?.provider ?? "Development"}
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {isBms ? "BMS Africa (mNotify)" : smsStatus?.provider?.toUpperCase() ?? "LOG"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sender ID: <span className="font-semibold text-slate-700">{smsStatus?.sender_id || "KMMedia"}</span>
          </p>
        </div>

        {/* SMS Balance Card */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              SMS Credit Balance
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M17 10l-5-4-5 4" />
            </svg>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {statusLoading ? "Checking…" : smsBalance !== undefined && smsBalance !== null ? `${smsBalance} Credits` : isBms ? "Connected" : "Unlimited (Log)"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isBms ? "Real-time balance via BMS Africa API" : "Simulated delivery mode"}
          </p>
        </div>

        {/* Email Delivery Service */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Email Dispatcher
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Resend Verified
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">Resend API</p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            admissions@kmmediatraininginstitute.com
          </p>
        </div>

        {/* Outbox Total */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Outbox Total
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">{total} Sent</p>
          <p className="mt-1 text-xs text-slate-500">Notifications recorded in ledger</p>
        </div>
      </div>

      {/* Quick SMS Tester Card */}
      {showQuickSms && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-sky-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Send Quick / Test SMS via BMS Africa
              </h2>
              <p className="text-xs text-slate-500">
                Verify immediate delivery to Ghanaian numbers (e.g. 024XXXXXXX or +233...).
              </p>
            </div>
            <button
              onClick={() => setShowQuickSms(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSendTestSms} className="mt-4 space-y-4">
            {testResult && (
              <div
                className={`rounded-lg p-3 text-sm border ${
                  testResult.ok
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {testResult.msg}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Recipient Phone Number
                </label>
                <input
                  type="text"
                  placeholder="0241234567 or +233..."
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Message Body
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {testMessage.length} / 160 characters ({Math.ceil(testMessage.length / 160) || 1} SMS)
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="KM Media: Test message from the learning management platform..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  required
                  maxLength={480}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sendingTest}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {sendingTest ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Dispatching via BMS Africa…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                    Send Test SMS
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Outbox Ledger Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Notification Outbox Ledger
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {total}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search recipient, subject…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 sm:w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 pl-8 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none"
              />
              <svg
                viewBox="0 0 24 24"
                className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            {/* Channel filter */}
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Channels</option>
              <option value="SMS">SMS Only</option>
              <option value="EMAIL">Email Only</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="QUEUED">Queued</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Subject / Message</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Sent At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading notifications…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No notifications match your current filter.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ChannelBadge channel={item.channel} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-900">
                      {item.recipient}
                    </td>
                    <td className="py-3 px-4 max-w-xs sm:max-w-md truncate text-slate-600">
                      <span className="font-semibold text-slate-800">
                        {item.subject ? `${item.subject} — ` : ""}
                      </span>
                      <span className="text-slate-500">{item.body.replace(/<[^>]+>/g, " ").slice(0, 80)}…</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      <span className="font-mono text-[11px] font-medium text-slate-700 uppercase">
                        {item.provider}
                      </span>
                      {item.provider_message_id && (
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                          {item.provider_message_id}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {formatDate(item.sent_at || item.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1.5">
                      <button
                        onClick={() => setActiveItem(item)}
                        className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                      >
                        View
                      </button>
                      {item.status === "FAILED" && (
                        <button
                          onClick={() => handleRetry(item.id)}
                          disabled={retryingId === item.id}
                          className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          {retryingId === item.id ? "Retrying…" : "Retry"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Inspection Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ChannelBadge channel={activeItem.channel} />
                  <StatusBadge status={activeItem.status} />
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">
                  {activeItem.subject ?? `${activeItem.channel} Message`}
                </h3>
                <p className="text-xs text-slate-500">
                  To: <span className="font-semibold text-slate-700">{activeItem.recipient}</span> · Sent: {formatDate(activeItem.sent_at || activeItem.created_at)}
                </p>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {activeItem.error_message && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  <span className="font-semibold">Provider Error: </span>
                  {activeItem.error_message}
                </div>
              )}

              {activeItem.channel === "SMS" ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {activeItem.body}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <iframe
                    title="Email Preview"
                    srcDoc={activeItem.body}
                    className="w-full h-80 border-0 rounded"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 text-xs">
                <div>
                  <span className="text-slate-400">Provider:</span>{" "}
                  <span className="font-medium text-slate-700 uppercase">{activeItem.provider}</span>
                </div>
                <div>
                  <span className="text-slate-400">Provider Msg ID:</span>{" "}
                  <span className="font-mono text-slate-700">{activeItem.provider_message_id ?? "—"}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              {activeItem.status === "FAILED" && (
                <button
                  onClick={() => {
                    void handleRetry(activeItem.id);
                    setActiveItem(null);
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                >
                  Retry Sending
                </button>
              )}
              <button
                onClick={() => setActiveItem(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotificationsAdminPage() {
  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <NotificationsAdminInner />
      </AppShell>
    </RouteGuard>
  );
}
