"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  formatMoney,
  INVOICE_STATUS_META,
  studentFinanceApi,
  type Balance,
  type Invoice,
  type Receipt,
  type StudentPayment,
} from "@/lib/api/finance";

const PURPOSE_LABELS: Record<string, string> = {
  APPLICATION_FEE: "Application fee",
  TUITION: "Tuition",
};

const PAYMENT_STATUS_META: Record<string, { label: string; classes: string }> = {
  SUCCESS: { label: "Paid", classes: "bg-emerald-100 text-emerald-700" },
  PENDING: { label: "Pending", classes: "bg-amber-100 text-amber-800" },
  FAILED: { label: "Failed", classes: "bg-red-100 text-red-700" },
  REVERSED: { label: "Reversed", classes: "bg-slate-200 text-slate-500" },
};

function StudentFinanceInner() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, inv, rec, pays] = await Promise.all([
          studentFinanceApi.balance(),
          studentFinanceApi.myInvoices(),
          studentFinanceApi.myReceipts().catch(() => [] as Receipt[]),
          studentFinanceApi.payments().catch(() => [] as StudentPayment[]),
        ]);
        if (!cancelled) {
          setBalance(b);
          setInvoices(inv);
          setReceipts(rec);
          setPayments(pays);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load your finance data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pay = async (invoiceId: string) => {
    setBusyId(invoiceId);
    setError(null);
    setNotice(null);
    try {
      const init = await studentFinanceApi.payInvoice(invoiceId, `${window.location.origin}/student/finance`);
      if (init.authorization_url) {
        window.location.href = init.authorization_url;
        return;
      }
      setNotice(
        `Payment ${init.payment_reference} was created for ${formatMoney(init.amount_minor)} — ` +
          "online payment is not configured yet; the bursary will confirm this payment."
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the payment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">My finance</h1>
            <p className="mt-1 text-sm text-slate-500">
              Tuition balance, invoices, and official receipts.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
          )}

          {balance && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Total billed</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatMoney(balance.billed_minor)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Paid</p>
                <p className="mt-1 text-xl font-semibold text-emerald-700">{formatMoney(balance.paid_minor)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Balance</p>
                <p className={`mt-1 text-xl font-semibold ${balance.balance_minor > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {formatMoney(balance.balance_minor)}
                </p>
              </div>
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
            {invoices.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No invoices yet — your tuition invoice appears here after enrollment.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {invoices.map((inv) => (
                  <li key={inv.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link
                          href={`/student/finance/invoice/${inv.id}`}
                          className="font-mono text-sm font-medium text-blue-700 hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {formatMoney(inv.amount_paid_minor)} paid of {formatMoney(inv.total_minor)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${INVOICE_STATUS_META[inv.status].classes}`}>
                          {INVOICE_STATUS_META[inv.status].label}
                        </span>
                        <Link
                          href={`/student/finance/invoice/${inv.id}`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View invoice
                        </Link>
                        {inv.balance_minor > 0 && inv.status !== "CANCELLED" && (
                          <button
                            disabled={busyId === inv.id}
                            onClick={() => pay(inv.id)}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                          >
                            {busyId === inv.id ? "Starting…" : "Pay now"}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Payment history</h2>
            <p className="mt-1 text-xs text-slate-500">
              Every payment made to the institute from your account, including the application fee.
            </p>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No payments on record.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {payments.map((p) => {
                  const meta = PAYMENT_STATUS_META[p.status] ?? { label: p.status, classes: "bg-slate-100 text-slate-600" };
                  const paidOn = p.verified_at ?? p.created_at;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{PURPOSE_LABELS[p.purpose] ?? p.purpose}</p>
                        <p className="font-mono text-xs text-slate-500">{p.reference}</p>
                        {paidOn && (
                          <p className="text-xs text-slate-400">
                            {new Date(paidOn).toLocaleDateString()} {p.channel ? `· via ${String(p.channel).replace(/_/g, " ")}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{formatMoney(p.amount_minor, p.currency)}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.classes}`}>{meta.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Receipts</h2>
            {receipts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No receipts yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {receipts.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <Link
                      href={`/student/finance/receipt/${r.id}`}
                      className="font-mono text-sm text-blue-700 hover:underline"
                    >
                      {r.receipt_number}
                    </Link>
                    <span className="text-sm text-slate-600">{formatMoney(r.amount_minor, r.currency)}</span>
                    <span className={`text-xs ${r.voided_at ? "text-red-600" : "text-emerald-700"}`}>
                      {r.voided_at ? "VOID" : "Valid"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </AppShell>
    </RouteGuard>
  );
}

export default function StudentFinancePage() {
  return <StudentFinanceInner />;
}
