"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, CreditCard, FileText, Receipt as ReceiptIcon, Wallet } from "lucide-react";
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

const PAYMENT_STATUS_META: Record<string, { label: string }> = {
  SUCCESS: { label: "Paid" },
  PENDING: { label: "Pending" },
  FAILED: { label: "Failed" },
  REVERSED: { label: "Reversed" },
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
      const init = await studentFinanceApi.payInvoice(
        invoiceId,
        `${window.location.origin}/student/finance`
      );
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
          <PageHeader
            eyebrow="Student Portal"
            title="My finance"
            description="Tuition balance, official invoices, Paystack payments, and downloadable receipts."
            breadcrumbs={[{ label: "Dashboard", href: "/dashboard/student" }, { label: "My finance" }]}
          />

          {error && <ErrorState title="Could not load finance data" detail={error} />}
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
              {notice}
            </div>
          )}

          {balance && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Total billed"
                value={formatMoney(balance.billed_minor)}
                icon={<Wallet className="h-4 w-4" />}
              />
              <StatCard
                label="Paid"
                value={formatMoney(balance.paid_minor)}
                icon={<CheckCircle2 className="h-4 w-4" />}
                tone="good"
              />
              <StatCard
                label="Balance"
                value={formatMoney(balance.balance_minor)}
                icon={<Banknote className="h-4 w-4" />}
                tone={balance.balance_minor > 0 ? "warn" : "good"}
              />
            </div>
          )}

          <SectionCard
            title="Invoices"
            description="Official tuition and fee invoices"
            icon={<FileText className="h-4 w-4" />}
          >
            {loading ? (
              <LoadingSkeleton rows={3} />
            ) : invoices.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No invoices yet"
                detail="Your tuition invoice appears here after enrolment."
              />
            ) : (
              <ul className="space-y-3">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition-colors hover:border-brand-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          href={`/student/finance/invoice/${inv.id}`}
                          className="font-mono text-sm font-bold text-brand-700 hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-600">
                          <span className="font-semibold text-emerald-700">
                            {formatMoney(inv.amount_paid_minor)}
                          </span>{" "}
                          paid of{" "}
                          <span className="font-semibold text-ink-900">
                            {formatMoney(inv.total_minor)}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={inv.status}
                          label={INVOICE_STATUS_META[inv.status]?.label}
                        />
                        <Link
                          href={`/student/finance/invoice/${inv.id}`}
                          className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-ink-800 hover:bg-slate-50"
                        >
                          View invoice
                        </Link>
                        {inv.balance_minor > 0 && inv.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="primary"
                            loading={busyId === inv.id}
                            onClick={() => pay(inv.id)}
                          >
                            {busyId === inv.id ? "Starting…" : "Pay now"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Payment history"
            description="Every payment made to the institute from your account, including the application fee."
            icon={<CreditCard className="h-4 w-4" />}
          >
            {payments.length === 0 ? (
              <EmptyState title="No payments on record" />
            ) : (
              <ul className="space-y-2.5">
                {payments.map((p) => {
                  const meta = PAYMENT_STATUS_META[p.status] ?? { label: p.status };
                  const paidOn = p.verified_at ?? p.created_at;
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {PURPOSE_LABELS[p.purpose] ?? p.purpose}
                        </p>
                        <p className="font-mono text-xs text-slate-500">{p.reference}</p>
                        {paidOn && (
                          <p className="text-xs text-slate-400">
                            {new Date(paidOn).toLocaleDateString()}{" "}
                            {p.channel ? `· via ${String(p.channel).replace(/_/g, " ")}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold tabular-nums text-ink-900">
                          {formatMoney(p.amount_minor, p.currency)}
                        </span>
                        <StatusBadge status={p.status} label={meta.label} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Receipts" description="Verified payment receipts" icon={<ReceiptIcon className="h-4 w-4" />}>
            {receipts.length === 0 ? (
              <EmptyState title="No receipts yet" />
            ) : (
              <ul className="space-y-2">
                {receipts.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                  >
                    <Link
                      href={`/student/finance/receipt/${r.id}`}
                      className="font-mono text-sm font-semibold text-brand-700 hover:underline"
                    >
                      {r.receipt_number}
                    </Link>
                    <span className="text-sm font-semibold tabular-nums text-ink-900">
                      {formatMoney(r.amount_minor, r.currency)}
                    </span>
                    <StatusBadge
                      status={r.voided_at ? "CANCELLED" : "ACTIVE"}
                      label={r.voided_at ? "VOID" : "Valid"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </AppShell>
    </RouteGuard>
  );
}

export default function StudentFinancePage() {
  return <StudentFinanceInner />;
}
