"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Banknote, Clock, Plus, Receipt, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/dashboard/ui";
import { Button, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
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

const PAYMENT_STATUS_META: Record<string, { label: string }> = {
  SUCCESS: { label: "Successful" },
  PENDING: { label: "Pending" },
  FAILED: { label: "Failed" },
  REVERSED: { label: "Reversed" },
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

function FinanceInner() {
  const toast = useToast();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof financeApi.summary>> | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatusValue | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [planWeights] = useState("40,30,30");
  const [planName] = useState("Semester plan");
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [fees, setFees] = useState<ProgramFee[]>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; title: string; tuition_minor?: number | null }>>([]);
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeProgramId, setFeeProgramId] = useState("");
  const [feeType, setFeeType] = useState<FeeType>("TUITION");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeBusy, setFeeBusy] = useState(false);

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
      const fee = await financeApi.createFee({
        program_id: feeProgramId,
        fee_type: feeType,
        amount_minor: amountMinor,
      });
      try {
        await financeApi.setFeeStatus(fee.id, "ACTIVE");
        const msg = `Fee published: ${feeType} ${formatMoney(fee.amount_minor, fee.currency)} — ${programTitle(fee.program_id)}.`;
        setNotice(msg);
        toast.success("Fee published", msg);
      } catch {
        setNotice(
          `Fee created as draft: ${feeType} ${formatMoney(fee.amount_minor, fee.currency)} — activate it below.`
        );
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
      toast.success(ok);
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
          <PageHeader
            eyebrow="Administration"
            title="Finance"
            description="Invoices, installment plans, verified payments, and balances. Money only moves when a Paystack webhook or server-side verification confirms it."
            breadcrumbs={[{ label: "Dashboard", href: "/dashboard/admin" }, { label: "Finance" }]}
          />

          {error && <ErrorState title="Finance error" detail={error} onRetry={load} />}
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
              {notice}
            </div>
          )}

          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Billed" value={formatMoney(summary.billed_minor)} icon={<Wallet className="h-4 w-4" />} />
              <StatCard label="Collected" value={formatMoney(summary.collected_minor)} icon={<Banknote className="h-4 w-4" />} tone="good" />
              <StatCard label="Outstanding" value={formatMoney(summary.outstanding_minor)} icon={<Clock className="h-4 w-4" />} tone="warn" />
              <StatCard label="Overdue" value={formatMoney(summary.overdue_minor)} icon={<AlertTriangle className="h-4 w-4" />} tone="bad" />
            </div>
          )}

          <SectionCard
            title="Programme fees"
            description="Publish each programme's tuition (and other) fees here. A student's tuition invoice can only be raised once an ACTIVE fee exists for their programme."
            icon={<Receipt className="h-4 w-4" />}
            action={
              <Button
                variant={showFeeForm ? "outline" : "primary"}
                size="sm"
                icon={showFeeForm ? undefined : <Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowFeeForm((v) => !v)}
              >
                {showFeeForm ? "Close" : "New fee"}
              </Button>
            }
          >
            {showFeeForm && (
              <div className="mb-4 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
                <select
                  value={feeProgramId}
                  onChange={(e) => {
                    setFeeProgramId(e.target.value);
                    const p = programs.find((x) => x.id === e.target.value);
                    if (p?.tuition_minor != null && feeType === "TUITION") {
                      setFeeAmount((p.tuition_minor / 100).toFixed(2));
                    }
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                >
                  <option value="">Programme…</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <select
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value as FeeType)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                >
                  {(["APPLICATION", "TUITION", "REGISTRATION", "EXAMINATION", "OTHER"] as FeeType[]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </option>
                    )
                  )}
                </select>
                <input
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  placeholder="Amount (GHS)"
                  inputMode="decimal"
                />
                <Button variant="primary" size="md" loading={feeBusy} onClick={submitFee}>
                  {feeBusy ? "Saving…" : "Create & publish"}
                </Button>
              </div>
            )}

            {fees.length === 0 ? (
              <EmptyState
                title="No fees configured yet"
                detail="Until you publish a tuition fee here, enrolled students show a zero balance."
              />
            ) : (
              <ul className="space-y-2">
                {fees.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {f.fee_type === "TUITION"
                          ? "Tuition"
                          : f.fee_type.charAt(0) + f.fee_type.slice(1).toLowerCase()}{" "}
                        · {programTitle(f.program_id)}
                      </p>
                      <p className="text-xs text-slate-500">
                        <span className="font-semibold text-ink-800">
                          {formatMoney(f.amount_minor, f.currency)}
                        </span>
                        {f.academic_session_id ? " · session-specific" : " · all sessions"}
                        {f.campus_id ? " · campus-specific" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={f.status} />
                      {f.status !== "ACTIVE" && f.status !== "ARCHIVED" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === f.id}
                          onClick={() => transitionFee(f, "ACTIVE")}
                        >
                          Activate
                        </Button>
                      )}
                      {f.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === f.id}
                          onClick={() => transitionFee(f, "INACTIVE")}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold tracking-tight text-ink-900">Invoices</h2>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                      filter === s
                        ? "bg-brand-600 text-white shadow-2xs"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s === "ALL" ? "All" : INVOICE_STATUS_META[s as InvoiceStatusValue].label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <LoadingSkeleton rows={4} />
            ) : invoices.length === 0 ? (
              <EmptyState
                icon
                title="No invoices in this view"
                detail="Raise a tuition charge from a student's enrolment, or an ad-hoc charge."
              />
            ) : (
              <ul className="space-y-3">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-bold text-ink-900">
                            {inv.invoice_number}
                          </p>
                          <StatusBadge
                            status={inv.status}
                            label={INVOICE_STATUS_META[inv.status]?.label}
                          />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          <span className="font-semibold tabular-nums text-emerald-700">
                            {formatMoney(inv.amount_paid_minor)}
                          </span>{" "}
                          paid of{" "}
                          <span className="font-semibold tabular-nums text-ink-900">
                            {formatMoney(inv.total_minor)}
                          </span>
                          <span className="text-slate-400">
                            {" "}
                            · balance {formatMoney(inv.balance_minor)}
                          </span>
                        </p>
                        {inv.due_date && (
                          <p className="mt-0.5 text-xs text-slate-400">Due {inv.due_date}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="outline"
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
                          >
                            {busyId === inv.id ? "Working…" : "Create 40/30/30 plan"}
                          </Button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setCancelFor(cancelFor === inv.id ? null : inv.id)}
                          >
                            Cancel invoice
                          </Button>
                        )}
                      </div>
                    </div>

                    {cancelFor === inv.id && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <label
                          className="block text-xs font-semibold text-ink-800"
                          htmlFor={`cr-${inv.id}`}
                        >
                          Cancellation reason (required, audited)
                        </label>
                        <input
                          id={`cr-${inv.id}`}
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                          placeholder="e.g. issued in error"
                        />
                        <div className="mt-2.5 flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCancelFor(null);
                              setCancelReason("");
                            }}
                          >
                            Close
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busyId === inv.id || cancelReason.trim().length < 3}
                            onClick={async () => {
                              await act(
                                inv.id,
                                () => financeApi.cancelInvoice(inv.id, cancelReason.trim()),
                                "Invoice cancelled."
                              );
                              setCancelFor(null);
                              setCancelReason("");
                            }}
                          >
                            Confirm cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SectionCard
            title="Finance history"
            description="Every payment transaction — application fees and tuition — newest first."
            action={
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPaymentFilter(s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                      paymentFilter === s
                        ? "bg-brand-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s === "ALL" ? "All" : PAYMENT_STATUS_META[s]?.label ?? s}
                  </button>
                ))}
              </div>
            }
          >
            {paymentsError && <ErrorState title="Could not load payment history" detail={paymentsError} onRetry={loadPayments} />}

            {paymentsLoading ? (
              <LoadingSkeleton rows={4} />
            ) : payments.length === 0 ? (
              <EmptyState icon title="No payment transactions in this view" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/70">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="hidden px-4 py-3 sm:table-cell">Date</th>
                      <th className="px-4 py-3">Payer</th>
                      <th className="hidden px-4 py-3 md:table-cell">Purpose</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Channel</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Reference</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {payments.map((pay) => (
                      <tr key={pay.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-500 sm:table-cell">
                          {formatDateTime(pay.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink-900">
                            {pay.payer_name || pay.payer_email || "—"}
                          </p>
                          {(pay.index_number || pay.payer_name) && (
                            <p className="text-xs text-slate-400">
                              {pay.index_number ? `${pay.index_number} · ` : ""}
                              {pay.payer_name ? pay.payer_email : ""}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                          {PAYMENT_PURPOSE_LABELS[pay.purpose] ?? pay.purpose}
                          {pay.invoice_number && (
                            <span className="block font-mono text-xs text-slate-400">
                              {pay.invoice_number}
                            </span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 capitalize text-slate-600 lg:table-cell">
                          {pay.channel ? pay.channel.replace(/_/g, " ") : "—"}
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-xs text-slate-500 lg:table-cell">
                          {pay.reference}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-ink-900">
                          {formatMoney(pay.amount_minor, pay.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={pay.status}
                            label={PAYMENT_STATUS_META[pay.status]?.label ?? pay.status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </AppShell>
    </RouteGuard>
  );
}

export default function AdminFinancePage() {
  return <FinanceInner />;
}
