"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  formatMoney,
  INVOICE_STATUS_META,
  studentFinanceApi,
  type InvoiceDocument,
} from "@/lib/api/finance";

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

const FEE_LABELS: Record<string, string> = {
  TUITION: "Tuition",
  REGISTRATION: "Registration",
  EXAM_FEE: "Examination fee",
  OTHER: "Other fee",
};

function InvoiceDocInner() {
  const params = useParams<{ invoiceId: string }>();
  const [doc, setDoc] = useState<InvoiceDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDoc = useCallback(() => {
    return studentFinanceApi
      .invoiceDocument(params.invoiceId)
      .then(setDoc)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this invoice"));
  }, [params.invoiceId]);

  useEffect(() => {
    let cancelled = false;
    studentFinanceApi
      .invoiceDocument(params.invoiceId)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load this invoice");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.invoiceId]);

  const payInstallment = async (installmentId: string) => {
    setBusyId(installmentId);
    setError(null);
    setNotice(null);
    try {
      const init = await studentFinanceApi.payInstallment(
        params.invoiceId,
        installmentId,
        `${window.location.origin}/student/finance`,
      );
      if (init.authorization_url) {
        window.location.href = init.authorization_url;
        return;
      }
      setNotice(
        `Payment ${init.payment_reference} was created for ${formatMoney(init.amount_minor)} — ` +
          "online payment is not configured yet; the bursary will confirm this payment.",
      );
      await loadDoc();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the payment");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
        <div className="mx-auto w-full max-w-3xl px-4 print:max-w-none print:px-0">
          {/* Toolbar — never printed */}
          <div className="mb-4 flex items-center justify-between print:hidden">
            <Link
              href="/student/finance"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← Back to My finance
            </Link>
            <button
              onClick={() => window.print()}
              disabled={!doc}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Print / Save as PDF
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 print:hidden">
              {notice}
            </div>
          )}
          {loading && !error && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Loading invoice…
            </div>
          )}

          {doc && (
            <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
              {/* Letterhead */}
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                  <p className="text-xl font-bold tracking-tight text-slate-900">
                    KM Media Training Institute
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Official invoice ·{" "}
                    <span className="font-mono">{doc.invoice_number}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                      INVOICE_STATUS_META[doc.status]?.classes ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {INVOICE_STATUS_META[doc.status]?.label ?? doc.status}
                  </span>
                  <p className="mt-2 text-xs text-slate-500">Issued: {fmtDate(doc.issued_at)}</p>
                  <p className="text-xs text-slate-500">Due: {fmtDate(doc.due_date)}</p>
                </div>
              </header>

              {/* Bill-to + programme */}
              <section className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Billed to
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{doc.student_name}</p>
                  <p className="text-sm text-slate-600">{doc.student_email}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">Index: {doc.index_number}</p>
                  {doc.admission_number && (
                    <p className="font-mono text-xs text-slate-500">Admission: {doc.admission_number}</p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Programme
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {doc.program_title ?? "—"}
                  </p>
                  {doc.academic_session_label && (
                    <p className="text-sm text-slate-600">Session: {doc.academic_session_label}</p>
                  )}
                </div>
              </section>

              {/* Line items */}
              <section className="py-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-2 font-semibold">Item</th>
                      <th className="pb-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-3">
                        <p className="font-medium text-slate-900">
                          {doc.description ?? FEE_LABELS[doc.fee_type] ?? doc.fee_type}
                        </p>
                        <p className="text-xs text-slate-500">{FEE_LABELS[doc.fee_type] ?? doc.fee_type}</p>
                      </td>
                      <td className="py-3 text-right font-medium text-slate-900">
                        {formatMoney(doc.subtotal_minor, doc.currency)}
                      </td>
                    </tr>
                    {doc.discount_minor > 0 && (
                      <tr className="border-b border-slate-100">
                        <td className="py-3 text-slate-600">Discount</td>
                        <td className="py-3 text-right text-slate-600">
                          −{formatMoney(doc.discount_minor, doc.currency)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="text-sm">
                    <tr>
                      <td className="pt-3 font-semibold text-slate-900">Total</td>
                      <td className="pt-3 text-right font-semibold text-slate-900">
                        {formatMoney(doc.total_minor, doc.currency)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-1 text-slate-500">Amount paid</td>
                      <td className="pt-1 text-right text-emerald-700">
                        {formatMoney(doc.amount_paid_minor, doc.currency)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-1 font-semibold text-slate-900">Balance due</td>
                      <td
                        className={`pt-1 text-right font-semibold ${
                          doc.balance_minor > 0 ? "text-amber-700" : "text-emerald-700"
                        }`}
                      >
                        {formatMoney(doc.balance_minor, doc.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              {/* Installment plan */}
              {doc.installments.length > 0 && (
                <section className="border-t border-slate-200 py-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Installment plan
                  </p>
                  <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-2 font-semibold">#</th>
                        <th className="pb-2 font-semibold">Due</th>
                        <th className="pb-2 text-right font-semibold">Amount</th>
                        <th className="pb-2 text-right font-semibold">Paid</th>
                        <th className="pb-2 text-right font-semibold">Status</th>
                        <th className="pb-2 text-right font-semibold print:hidden">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.installments.map((i) => {
                        const settled =
                          i.status === "PAID" || i.status === "WAIVED" || i.status === "CANCELLED";
                        const remaining = i.amount_minor - i.amount_paid_minor;
                        return (
                          <tr key={i.id} className="border-t border-slate-100">
                            <td className="py-2 text-slate-600">{i.installment_number}</td>
                            <td className="py-2 text-slate-600">{fmtDate(i.due_date)}</td>
                            <td className="py-2 text-right text-slate-900">
                              {formatMoney(i.amount_minor, doc.currency)}
                            </td>
                            <td className="py-2 text-right text-slate-600">
                              {formatMoney(i.amount_paid_minor, doc.currency)}
                            </td>
                            <td className="py-2 text-right text-xs font-medium uppercase text-slate-500">
                              {i.status}
                            </td>
                            <td className="py-2 text-right print:hidden">
                              {!settled && remaining > 0 && doc.status !== "CANCELLED" && (
                                <button
                                  disabled={busyId === i.id}
                                  onClick={() => payInstallment(i.id)}
                                  className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                                >
                                  {busyId === i.id ? "Starting…" : `Pay ${formatMoney(remaining, doc.currency)}`}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </section>
              )}

              {/* Linked receipts */}
              {doc.receipts.length > 0 && (
                <section className="border-t border-slate-200 py-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Payments received against this invoice
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {doc.receipts.map((r) => (
                      <li key={r.id} className="flex items-center justify-between">
                        <Link
                          href={`/student/finance/receipt/${r.id}`}
                          className="font-mono text-blue-700 hover:underline print:text-slate-900 print:no-underline"
                        >
                          {r.receipt_number}
                        </Link>
                        <span className="text-slate-700">{formatMoney(r.amount_minor, r.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {doc.cancelled_reason && (
                <p className="border-t border-slate-200 pt-4 text-sm text-red-600">
                  Cancellation reason: {doc.cancelled_reason}
                </p>
              )}

              <footer className="border-t border-slate-200 pt-4 text-xs text-slate-400">
                This invoice was issued electronically by the KM Media Training Institute bursary
                system. Pay via the portal (My finance → Pay now) or at the institute office.
              </footer>
            </article>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}

export default function InvoiceDocumentPage() {
  return <InvoiceDocInner />;
}
