"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { formatMoney, studentFinanceApi, type ReceiptDocument } from "@/lib/api/finance";

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function ReceiptDocInner() {
  const params = useParams<{ receiptId: string }>();
  const [doc, setDoc] = useState<ReceiptDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    studentFinanceApi
      .receiptDocument(params.receiptId)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load this receipt");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.receiptId]);

  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
        <div className="mx-auto w-full max-w-2xl px-4 print:max-w-none print:px-0">
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
          {loading && !error && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Loading receipt…
            </div>
          )}

          {doc && (
            <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
              {/* Letterhead */}
              <header className="border-b border-slate-200 pb-6 text-center">
                <p className="text-xl font-bold tracking-tight text-slate-900">
                  KM Media Training Institute
                </p>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
                  Official receipt of payment
                </p>
                <p className="mt-2 font-mono text-sm font-semibold text-slate-900">
                  {doc.receipt_number}
                </p>
              </header>

              {/* Received */}
              <section className="border-b border-slate-200 py-6 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Received from
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{doc.payer_name}</p>
                <p className="text-sm text-slate-600">{doc.payer_email}</p>
                {doc.index_number && (
                  <p className="mt-1 font-mono text-xs text-slate-500">Index: {doc.index_number}</p>
                )}
              </section>

              {/* Amount — the headline of any receipt */}
              <section className="border-b border-slate-200 py-8 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Amount received
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-700">
                  {formatMoney(doc.amount_minor, doc.currency)}
                </p>
              </section>

              {/* Details */}
              <section className="py-6">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Date issued</dt>
                    <dd className="text-right font-medium text-slate-900">{fmtDate(doc.issued_at)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Payment reference</dt>
                    <dd className="text-right font-mono text-slate-900">
                      {doc.payment_reference ?? "—"}
                    </dd>
                  </div>
                  {doc.payment_channel && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Channel</dt>
                      <dd className="text-right capitalize text-slate-900">
                        {doc.payment_channel.replace(/_/g, " ")}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">For</dt>
                    <dd className="text-right text-slate-900">{doc.description ?? "Payment to the institute"}</dd>
                  </div>
                  {doc.program_title && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Programme</dt>
                      <dd className="text-right text-slate-900">{doc.program_title}</dd>
                    </div>
                  )}
                  {doc.invoice_number && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Against invoice</dt>
                      <dd className="text-right font-mono text-slate-900">{doc.invoice_number}</dd>
                    </div>
                  )}
                </dl>
              </section>

              <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
                Received and receipted by the KM Media Training Institute bursary system. Keep this
                receipt as proof of payment.
              </footer>
            </article>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}

export default function ReceiptDocumentPage() {
  return <ReceiptDocInner />;
}
