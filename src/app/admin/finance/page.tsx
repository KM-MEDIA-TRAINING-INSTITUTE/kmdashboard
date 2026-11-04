"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  financeApi,
  formatMoney,
  INVOICE_STATUS_META,
  type FeeStatusValue,
  type FeeType,
  type FinancePayment,
  type Invoice,
  type InvoiceStatusValue,
  type ProgramFee,
} from "@/lib/api/finance";
import { programsApi } from "@/lib/api/courses";

const STATUS_FILTERS: Array<InvoiceStatusValue | "ALL"> = [
  "ALL",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

const PAYMENT_STATUS_FILTERS = ["ALL", "SUCCESS", "PENDING", "FAILED", "REVERSED"] as const;

const PAYMENT_STATUS_META: Record<string, { label: string; classes: string }> = {
  SUCCESS: { label: "Successful", classes: "bg-emerald-100 text-emerald-700" },
  PENDING: { label: "Pending", classes: "bg-amber-100 text-amber-800" },
  FAILED: { label: "Failed", classes: "bg-red-100 text-red-700" },
  REVERSED: { label: "Reversed", classes: "bg-slate-200 text-slate-500" },
};

const PAYMENT_PURPOSE_LABELS: Record<string, string> = {
  APPLICATION_FEE: "Application fee",
  TUITION: "Tuition",
  REGISTRATION: "Registration",
  EXAMINATION: "Examination",
  OTHER: "Other",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function FinanceInner() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof financeApi.summary>> | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatusValue | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [planWeights, setPlanWeights] = useState("40,30,30");
  const [planName, setPlanName] = useState("Semester plan");
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Program fee configuration — the bursary must publish an ACTIVE TUITION
  // fee per programme before tuition can be raised against an enrollment.
  const [fees, setFees] = useState<ProgramFee[]>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; title: string; tuition_minor?: number | null }>>([]);
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeProgramId, setFeeProgramId] = useState("");
  const [feeType, setFeeType] = useState<FeeType>("TUITION");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeBusy, setFeeBusy] = useState(false);

  // Finance history — every payment transaction (application fees + tuition).
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_STATUS_FILTERS)[number]>("ALL");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, inv, f] = await Promise.all([
        financeApi.summary(),
        financeApi.invoices({ status: filter === "ALL" ? undefined : filter, limit: 200 }),
        financeApi.fees().catch(() => [] as ProgramFee[]),
      ]);
      setSummary(s);
      setInvoices(inv);
      setFees(f);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load finance data");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    programsApi.list().then(setPrograms).catch(() => setPrograms([]));
  }, []);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const rows = await financeApi.payments({
        status: paymentFilter === "ALL" ? undefined : paymentFilter,
        limit: 200,
      });
      setPayments(rows);
    } catch (err) {
      setPaymentsError(err instanceof ApiError ? err.message : "Could not load payment history");
    } finally {
      setPaymentsLoading(false);
    }
  }, [paymentFilter]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const programTitle = (id: string) => programs.find((p) => p.id === id)?.title ?? id.slice(0, 8);

  const submitFee = async () => {
    setFeeBusy(true);
    setError(null);
    setNotice(null);
    try {
      const amountMinor = Math.round(parseFloat(feeAmount.replace(/,/g, "")) * 100);
      if (!feeProgramId) {
        setError("Pick a programme for this fee.");
        return;
      }
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        setError("Enter a positive amount in cedis.");
        return;
      }
      const fee = await financeApi.createFee({ program_id: feeProgramId, fee_type: feeType, amount_minor: amountMinor });
      // Fees are created as DRAFT; publish immediately so issuers can use them.
      try {
        await financeApi.setFeeStatus(fee.id, "ACTIVE");
        setNotice(`Fee published: ${feeType} ${formatMoney(fee.amount_minor, fee.currency)} — ${programTitle(fee.program_id)}.`);
      } catch {
        setNotice(`Fee created as draft: ${feeType} ${formatMoney(fee.amount_minor, fee.currency)} — activate it below.`);
      }
      setShowFeeForm(false);
      setFeeAmount("");
      setFeeProgramId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the fee");
    } finally {
      setFeeBusy(false);
    }
  };

  const transitionFee = (fee: ProgramFee, target: FeeStatusValue) =>
    act(fee.id, () => financeApi.setFeeStatus(fee.id, target), `Fee marked ${target.toLowerCase()}.`);

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Finance</h1>
            <p className="mt-1 text-sm text-slate-500">
              Invoices, installment plans, verified payments, and balances. Money
              only moves when a Paystack webhook or server-side verification
              confirms it — never from the browser.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
          )}

          {summary && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Stat label="Billed" value={formatMoney(summary.billed_minor)} tone="text-slate-900" />
              <Stat label="Collected" value={formatMoney(summary.collected_minor)} tone="text-emerald-700" />
              <Stat label="Outstanding" value={formatMoney(summary.outstanding_minor)} tone="text-amber-700" />
              <Stat label="Overdue" value={formatMoney(summary.overdue_minor)} tone="text-red-700" />
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Programme fees</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Publish each programme&apos;s tuition (and other) fees here. A student&apos;s tuition invoice can only be
                  raised once an ACTIVE fee exists for their programme.
                </p>
              </div>
              <button
                onClick={() => setShowFeeForm((v) => !v)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
              >
                {showFeeForm ? "Close" : "New fee"}
              </button>
            </div>

            {showFeeForm && (
              <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
                <select
                  value={feeProgramId}
                  onChange={(e) => {
                    setFeeProgramId(e.target.value);
                    const p = programs.find((x) => x.id === e.target.value);
                    if (p?.tuition_minor != null && feeType === "TUITION") {
                      setFeeAmount((p.tuition_minor / 100).toFixed(2));
                    }
                  }}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Programme…</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <select
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value as FeeType)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {(["APPLICATION", "TUITION", "REGISTRATION", "EXAMINATION", "OTHER"] as FeeType[]).map((t) => (
                    <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                  ))}
                </select>
                <input
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Amount (GHS)"
                  inputMode="decimal"
                />
                <button
                  disabled={feeBusy}
                  onClick={submitFee}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {feeBusy ? "Saving…" : "Create & publish"}
                </button>
              </div>
            )}

            {fees.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No fees configured yet — until you publish a tuition fee here, enrolled students show a zero balance.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {fees.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {f.fee_type === "TUITION" ? "Tuition" : f.fee_type.charAt(0) + f.fee_type.slice(1).toLowerCase()} · {programTitle(f.program_id)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatMoney(f.amount_minor, f.currency)}
                        {f.academic_session_id ? " · session-specific" : " · all sessions"}
                        {f.campus_id ? " · campus-specific" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          f.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700"
                            : f.status === "DRAFT"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {f.status}
                      </span>
                      {f.status !== "ACTIVE" && f.status !== "ARCHIVED" && (
                        <button
                          disabled={busyId === f.id}
                          onClick={() => transitionFee(f, "ACTIVE")}
                          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}
                      {f.status === "ACTIVE" && (
                        <button
                          disabled={busyId === f.id}
                          onClick={() => transitionFee(f, "INACTIVE")}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === s
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s === "ALL" ? "All" : INVOICE_STATUS_META[s as InvoiceStatusValue].label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No invoices in this view. Raise a tuition charge from a student&apos;s
              enrollment, or an ad-hoc charge.
            </div>
          ) : (
            <ul className="space-y-3">
              {invoices.map((inv) => (
                <li key={inv.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-slate-900">{inv.invoice_number}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${INVOICE_STATUS_META[inv.status].classes}`}>
                          {INVOICE_STATUS_META[inv.status].label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatMoney(inv.amount_paid_minor)} paid of {formatMoney(inv.total_minor)}
                        <span className="text-slate-400"> · balance {formatMoney(inv.balance_minor)}</span>
                      </p>
                      {inv.due_date && (
                        <p className="mt-0.5 text-xs text-slate-400">Due {inv.due_date}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                        <button
                          disabled={busyId === inv.id}
                          onClick={() =>
                            act(
                              inv.id,
                              () =>
                                financeApi.createPlan(inv.id, {
                                  plan_name: planName,
                                  weights: planWeights
                                    .split(",")
                                    .map((w) => Number(w.trim()))
                                    .filter((n) => n > 0),
                                }),
                              "Installment plan created."
                            )
                          }
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busyId === inv.id ? "Working…" : "Create 40/30/30 plan"}
                        </button>
                      )}
                      {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                        <button
                          onClick={() => setCancelFor(cancelFor === inv.id ? null : inv.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Cancel invoice
                        </button>
                      )}
                    </div>
                  </div>

                  {cancelFor === inv.id && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <label className="block text-xs font-medium text-slate-700" htmlFor={`cr-${inv.id}`}>
                        Cancellation reason (required, audited)
                      </label>
                      <input
                        id={`cr-${inv.id}`}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        placeholder="e.g. issued in error"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          className="text-xs text-slate-500 hover:text-slate-700"
                          onClick={() => {
                            setCancelFor(null);
                            setCancelReason("");
                          }}
                        >
                          Close
                        </button>
                        <button
                          disabled={busyId === inv.id || cancelReason.trim().length < 3}
                          onClick={async () => {
                            await act(inv.id, () => financeApi.cancelInvoice(inv.id, cancelReason.trim()), "Invoice cancelled.");
                            setCancelFor(null);
                            setCancelReason("");
                          }}
                          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          Cancel invoice
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Finance history</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Every payment transaction — application fees and tuition — newest first.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPaymentFilter(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      paymentFilter === s
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s === "ALL" ? "All" : PAYMENT_STATUS_META[s]?.label ?? s}
                  </button>
                ))}
              </div>
            </div>

            {paymentsError && (
              <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {paymentsError}
              </div>
            )}

            {paymentsLoading ? (
              <p className="px-6 py-6 text-sm text-slate-400">Loading payment history…</p>
            ) : payments.length === 0 ? (
              <div className="px-6 py-6 text-sm text-slate-500">
                No payment transactions in this view.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                      <th className="hidden px-6 py-3 font-medium sm:table-cell">Date</th>
                      <th className="px-6 py-3 font-medium">Payer</th>
                      <th className="hidden px-6 py-3 font-medium md:table-cell">Purpose</th>
                      <th className="hidden px-6 py-3 font-medium lg:table-cell">Channel</th>
                      <th className="hidden px-6 py-3 font-medium lg:table-cell">Reference</th>
                      <th className="px-6 py-3 text-right font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((pay) => {
                      const meta = PAYMENT_STATUS_META[pay.status] ?? {
                        label: pay.status,
                        classes: "bg-slate-100 text-slate-600",
                      };
                      return (
                        <tr key={pay.id} className="hover:bg-slate-50">
                          <td className="hidden whitespace-nowrap px-6 py-3 text-slate-500 sm:table-cell">
                            {formatDateTime(pay.created_at)}
                          </td>
                          <td className="px-6 py-3">
                            <p className="font-medium text-slate-800">
                              {pay.payer_name || pay.payer_email || "—"}
                            </p>
                            {(pay.index_number || pay.payer_name) && (
                              <p className="text-xs text-slate-400">
                                {pay.index_number ? `${pay.index_number} · ` : ""}
                                {pay.payer_name ? pay.payer_email : ""}
                              </p>
                            )}
                          </td>
                          <td className="hidden px-6 py-3 text-slate-600 md:table-cell">
                            {PAYMENT_PURPOSE_LABELS[pay.purpose] ?? pay.purpose}
                            {pay.invoice_number && (
                              <span className="block font-mono text-xs text-slate-400">
                                {pay.invoice_number}
                              </span>
                            )}
                          </td>
                          <td className="hidden px-6 py-3 text-slate-600 capitalize lg:table-cell">
                            {pay.channel ? pay.channel.replace(/_/g, " ") : "—"}
                          </td>
                          <td className="hidden px-6 py-3 font-mono text-xs text-slate-500 lg:table-cell">
                            {pay.reference}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3 text-right font-medium text-slate-800">
                            {formatMoney(pay.amount_minor, pay.currency)}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.classes}`}>
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </AppShell>
    </RouteGuard>
  );
}

export default function AdminFinancePage() {
  return <FinanceInner />;
}
