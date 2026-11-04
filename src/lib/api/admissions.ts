import { api } from "./client";

/**
 * Phase 3 admissions API surface.
 *
 * Everything here is permission-checked server-side (application:read /
 * application:review / admission:read / admission:create); the UI only hides
 * what the backend would refuse anyway.
 */

export type ApplicationStatusValue =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MORE_INFO"
  | "APPROVED"
  | "REJECTED";

export interface ApplicationSummary {
  id: string;
  application_number: string;
  program_id: string;
  program_title: string | null;
  payment_reference: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: ApplicationStatusValue;
  form_category: string | null;
  submission_channel: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  info_request: string | null;
  info_response: string | null;
  info_requested_at: string | null;
  info_responded_at: string | null;
}

export interface ApplicationDetail extends ApplicationSummary {
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  hometown: string | null;
  religion: string | null;
  marital_status: string | null;
  occupation: string | null;
  residential_address: string | null;
  education_level: string | null;
  previous_school: string | null;
  completion_year: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_occupation: string | null;
  guardian_relationship: string | null;
  preferred_mode: string | null;
  hostel_required: string | null;
  learning_objectives: string | null;
  extra_data: Record<string, string>;
}

export interface ApplicationStats {
  SUBMITTED: number;
  UNDER_REVIEW: number;
  MORE_INFO: number;
  APPROVED: number;
  REJECTED: number;
}

export interface AdmissionRow {
  id: string;
  admission_number: string;
  application_id: string;
  program_id: string;
  index_number: string;
  status: string;
  admitted_at: string;
  note: string | null;
  application_number: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  program_title: string | null;
  program_code: string | null;
}

export type ReviewDecision = "APPROVE" | "REJECT" | "REQUEST_INFO" | "START_REVIEW";

export const applicationsApi = {
  list(params?: {
    status?: ApplicationStatusValue[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApplicationSummary[]> {
    const qs = new URLSearchParams();
    for (const s of params?.status ?? []) qs.append("status", s);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api<ApplicationSummary[]>(`/applications${suffix}`);
  },

  stats(): Promise<ApplicationStats> {
    return api<ApplicationStats>("/applications/stats");
  },

  detail(applicationId: string): Promise<ApplicationDetail> {
    return api<ApplicationDetail>(`/applications/${applicationId}`);
  },

  decide(
    applicationId: string,
    decision: ReviewDecision,
    note?: string
  ): Promise<ApplicationSummary> {
    return api<ApplicationSummary>(`/applications/${applicationId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note: note ?? null }),
    });
  },

  admit(applicationId: string): Promise<{
    student_id: string;
    index_number: string;
    admission_number: string;
    user_email: string;
    full_name: string;
    must_change_password: boolean;
    user_id: string;
    credential_handoff_required: boolean;
    deliveries: Array<{
      id: string;
      channel: string;
      status: string;
      delivered_at: string | null;
      error_message: string | null;
    }>;
  }> {
    return api(`/applications/${applicationId}/admit`, { method: "POST" });
  },
};

export const admissionsApi = {
  list(params?: { search?: string; limit?: number; offset?: number }): Promise<AdmissionRow[]> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api<AdmissionRow[]>(`/admissions${suffix}`);
  },

  detail(admissionId: string): Promise<AdmissionRow> {
    return api<AdmissionRow>(`/admissions/${admissionId}`);
  },
};

export interface MyProgram {
  admission_number: string;
  index_number: string;
  admission_status: string;
  admitted_at: string;
  enrollment_status: string;
  current_level: number;
  program: {
    id: string;
    slug: string;
    code: string;
    title: string;
    description: string;
    long_description: string;
    category: string;
    duration_weeks: number | null;
    certificate: string | null;
    tuition_minor: number | null;
    application_fee_minor: number;
    requirements: string;
    opportunities: string;
    modules: string;
    is_active: boolean;
    accepting_applications: boolean;
  };
}

export const studentsApi = {
  myProgram(): Promise<MyProgram> {
    return api<MyProgram>("/students/me/programme");
  },
};
