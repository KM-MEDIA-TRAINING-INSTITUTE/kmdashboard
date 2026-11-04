import { api } from "./client";

/**
 * Phase 6 finance API surface.
 *
 * Permissions are enforced server-side (finance:read|manage, fee:manage,
 * invoice:manage, plan:manage, payment:verify, receipt:read); the UI only
 * hides what the backend would refuse anyway. Money is integer minor units
 * (pesewas) end to end — this client never converts with floats.
 */

export type FeeType = "APPLICATION" | "TUITION" | "REGISTRATION" | "EXAMINATION" | "OTHER";
export type FeeStatusValue = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type InvoiceStatusValue =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";
export type InstallmentStatusValue =
  | "PENDING"
  | "DUE"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "WAIVED"
  | "CANCELLED";

export interface ProgramFee {
  id: string;
  program_id: string;
  fee_type: FeeType;
  amount_minor: number;
  currency: string;
  academic_session_id: string | null;
  campus_id: string | null;
  effective_from: string | null;
  effective_until: string | null;
  status: FeeStatusValue;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  student_id: string;
  charge_id: string;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  balance_minor: number;
  status: InvoiceStatusValue;
  issued_at: string | null;
  due_date: string | null;
  cancelled_reason: string | null;
}

export interface Installment {
  id: string;
  installment_number: number;
  description: string | null;
  amount_minor: number;
  amount_paid_minor: number;
  balance_minor: number;
  currency: string;
  due_date: string | null;
  status: InstallmentStatusValue;
  paid_at: string | null;
}

export interface PaymentPlan {
  id: string;
  student_id: string;
  invoice_id: string;
  plan_name: string;
  total_minor: number;
  currency: string;
  number_of_installments: number;
  status: string;
  installments: Installment[];
}

export interface FinancePayment {
  id: string;
  reference: string;
  purpose: string;
  status: string;
  amount_minor: number;
  currency: string;
  channel: string | null;
  payer_email: string;
  charge_id: string | null;
  installment_id?: string | null;
  verified_at: string | null;
  created_at: string | null;
  // Resolved display identity from the finance history ledger.
  payer_name?: string | null;
  index_number?: string | null;
  invoice_number?: string | null;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  payment_id: string;
  student_id: string | null;
  charge_id: string | null;
  invoice_id: string | null;
  amount_minor: number;
  currency: string;
  issued_at: string | null;
  voided_at: string | null;
}

export interface Balance {
  billed_minor: number;
  paid_minor: number;
  balance_minor: number;
  currency: string;
  invoice_count: number;
}

export interface FinanceSummary extends Balance {
  collected_minor: number;
  outstanding_minor: number;
  overdue_minor: number;
}

export interface PayInit {
  payment_reference: string;
  authorization_url: string | null;
  amount_minor: number;
  currency: string;
  provider_configured: boolean;
}

/** Server-side money formatter — the single display conversion point. */
export function formatMoney(amountMinor: number, currency = "GHS"): string {
  const symbol = currency === "GHS" ? "GH\u20b5" : currency;
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  return `${sign}${symbol} ${Math.floor(abs / 100).toLocaleString()}.${String(abs % 100).padStart(2, "0")}`;
}

export const financeApi = {
  fees(): Promise<ProgramFee[]> {
    return api<ProgramFee[]>("/fees");
  },

  createFee(payload: {
    program_id: string;
    fee_type: FeeType;
    amount_minor: number;
    academic_session_id?: string | null;
    campus_id?: string | null;
    effective_from?: string | null;
    effective_until?: string | null;
  }): Promise<ProgramFee> {
    return api<ProgramFee>("/fees", { method: "POST", body: JSON.stringify(payload) });
  },

  setFeeStatus(feeId: string, status: FeeStatusValue): Promise<ProgramFee> {    
    return api<ProgramFee>(`/fees/${feeId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },
  
  // Raise the programme's ACTIVE TUITION fee against an enrollment: snapshot
  // into a charge + ISSUED invoice. 400/422 if no fee is configured yet.
  issueTuition(enrollmentId: string, dueDate?: string | null): Promise<Invoice> {
    const qs = dueDate ? `?due_date=${encodeURIComponent(dueDate)}` : "";
    return api<Invoice>(`/charges/tuition/${enrollmentId}${qs}`, { method: "POST" });
  },

  invoices(params: { student_id?: string; status?: InvoiceStatusValue; limit?: number } = {}): Promise<Invoice[]> {
    const qs = new URLSearchParams();
    if (params.student_id) qs.set("student_id", params.student_id);
    if (params.status) qs.set("status", params.status);
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api<Invoice[]>(`/invoices${suffix}`);
  },

  invoiceDetail(invoiceId: string): Promise<Invoice> {
    return api<Invoice>(`/invoices/${invoiceId}`);
  },

  createTuitionCharge(enrollmentId: string, dueDate?: string): Promise<Invoice> {
    const suffix = dueDate ? `?due_date=${dueDate}` : "";
    return api<Invoice>(`/charges/tuition/${enrollmentId}${suffix}`, { method: "POST" });
  },

  cancelInvoice(invoiceId: string, reason: string): Promise<Invoice> {
    return api<Invoice>(`/invoices/${invoiceId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  createPlan(
    invoiceId: string,
    payload: { plan_name: string; installments?: Array<{ amount_minor: number; due_date?: string | null }>; weights?: number[]; due_dates?: Array<string | null> }
  ): Promise<PaymentPlan> {
    return api<PaymentPlan>(`/invoices/${invoiceId}/plan`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  planForInvoice(invoiceId: string): Promise<PaymentPlan> {
    return api<PaymentPlan>(`/invoices/${invoiceId}/plan`);
  },

  cancelPlan(planId: string, reason: string): Promise<PaymentPlan> {
    return api<PaymentPlan>(`/plans/${planId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  payments(params: { status?: string; limit?: number } = {}): Promise<FinancePayment[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api<FinancePayment[]>(`/payments${suffix}`);
  },

  verifyPayment(paymentId: string): Promise<FinancePayment> {
    return api<FinancePayment>(`/payments/${paymentId}/verify`, { method: "POST" });
  },

  reversePayment(paymentId: string, reason: string): Promise<FinancePayment> {
    return api<FinancePayment>(`/payments/${paymentId}/reverse`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  receipts(): Promise<Receipt[]> {
    return api<Receipt[]>("/receipts");
  },

  summary(): Promise<FinanceSummary> {
    return api<FinanceSummary>("/finance/summary");
  },
};

export interface StudentPayment {
  id: string;
  reference: string;
  purpose: string; // APPLICATION_FEE | TUITION | ...
  status: string; // SUCCESS | PENDING | FAILED | REVERSED
  amount_minor: number;
  currency: string;
  channel: string | null;
  payer_email: string;
  verified_at: string | null;
  created_at: string | null;
}

// Full printable invoice payload (GET /student/invoices/{id}).
export interface InvoiceDocument {
  id: string;
  invoice_number: string;
  status: InvoiceStatusValue;
  issued_at: string | null;
  due_date: string | null;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  balance_minor: number;
  student_name: string;
  student_email: string;
  index_number: string;
  admission_number: string | null;
  program_title: string | null;
  fee_type: string;
  description: string | null;
  academic_session_label: string | null;
  cancelled_reason: string | null;
  installments: Installment[];
  receipts: Receipt[];
}

// Full printable receipt payload (GET /student/receipts/{id}).
export interface ReceiptDocument {
  id: string;
  receipt_number: string;
  issued_at: string | null;
  amount_minor: number;
  currency: string;
  payment_reference: string | null;
  payment_channel: string | null;
  payer_name: string;
  payer_email: string;
  index_number: string | null;
  program_title: string | null;
  description: string | null;
  invoice_number: string | null;
}

export const studentFinanceApi = {
  balance(): Promise<Balance> {
    return api<Balance>("/student/finance");
  },

  myInvoices(): Promise<Invoice[]> {
    return api<Invoice[]>("/student/invoices");
  },

  myReceipts(): Promise<Receipt[]> {
    return api<Receipt[]>("/student/receipts");
  },

  // Full payment trail — application fee paid at admission plus tuition payments.
  payments(): Promise<StudentPayment[]> {
    return api<StudentPayment[]>("/student/payments");
  },

  payInvoice(invoiceId: string, callbackUrl?: string): Promise<PayInit> {
    return api<PayInit>(`/student/invoices/${invoiceId}/pay`, {
      method: "POST",
      body: JSON.stringify({ callback_url: callbackUrl ?? null }),
    });
  },

  // Pay ONE installment of a plan (server-side amount = that installment's balance).
  payInstallment(invoiceId: string, installmentId: string, callbackUrl?: string): Promise<PayInit> {
    return api<PayInit>(`/student/invoices/${invoiceId}/installments/${installmentId}/pay`, {
      method: "POST",
      body: JSON.stringify({ callback_url: callbackUrl ?? null }),
    });
  },

  // Official printable documents.
  invoiceDocument(invoiceId: string): Promise<InvoiceDocument> {
    return api<InvoiceDocument>(`/student/invoices/${invoiceId}`);
  },

  receiptDocument(receiptId: string): Promise<ReceiptDocument> {
    return api<ReceiptDocument>(`/student/receipts/${receiptId}`);
  },
};

export const INVOICE_STATUS_META: Record<InvoiceStatusValue, { label: string; classes: string }> = {
  DRAFT: { label: "Draft", classes: "bg-slate-100 text-slate-600" },
  ISSUED: { label: "Issued", classes: "bg-blue-100 text-blue-700" },
  PARTIALLY_PAID: { label: "Partially paid", classes: "bg-amber-100 text-amber-800" },
  PAID: { label: "Paid", classes: "bg-emerald-100 text-emerald-700" },
  OVERDUE: { label: "Overdue", classes: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelled", classes: "bg-slate-200 text-slate-500" },
};

export const FEE_STATUS_META: Record<FeeStatusValue, { label: string; classes: string }> = {
  DRAFT: { label: "Draft", classes: "bg-slate-100 text-slate-600" },
  ACTIVE: { label: "Active", classes: "bg-emerald-100 text-emerald-700" },
  INACTIVE: { label: "Inactive", classes: "bg-amber-100 text-amber-800" },
  ARCHIVED: { label: "Archived", classes: "bg-slate-200 text-slate-500" },
};

export const INSTALLMENT_STATUS_META: Record<InstallmentStatusValue, string> = {
  PENDING: "text-slate-500",
  DUE: "text-blue-700",
  PARTIALLY_PAID: "text-amber-700",
  PAID: "text-emerald-700",
  OVERDUE: "text-red-700",
  WAIVED: "text-slate-400",
  CANCELLED: "text-slate-400",
};
