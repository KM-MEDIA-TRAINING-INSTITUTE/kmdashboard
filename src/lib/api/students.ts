import { api, apiForm } from "./client";

/**
 * Phase 4 API surface — students, enrollments, academic structure.
 * All write actions are permission-checked server-side; the UI only hides
 * what the backend would refuse.
 */

export type StudentStatusValue =
  | "ADMITTED"
  | "ENROLLED"
  | "ACTIVE"
  | "SUSPENDED"
  | "DEFERRED"
  | "WITHDRAWN"
  | "COMPLETED"
  | "GRADUATED"
  | "EXPELLED";

export type EnrollmentStatusValue =
  | "PENDING"
  | "CONFIRMED"
  | "ACTIVE"
  | "SUSPENDED"
  | "DEFERRED"
  | "WITHDRAWN"
  | "COMPLETED";

export interface StudentRow {
  id: string;
  user_id: string | null;
  student_id: string | null;
  index_number: string;
  status: StudentStatusValue;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  campus_name: string | null;
  program_title: string | null;
  enrollment_status: string;
  current_level: number;
  account_active: boolean | null;
  created_at: string | null;
}

export interface StudentDetail extends StudentRow {
  admission_number: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  alt_phone: string | null;
  residential_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_alt_phone: string | null;
  emergency_contact_email: string | null;
  emergency_contact_address: string | null;
  previous_institution: string | null;
  highest_qualification: string | null;
  graduation_year: string | null;
}

/** Student-writable payload for PATCH /students/me (server filters the rest). */
export interface StudentProfileUpdatePayload {
  full_name?: string;
  phone?: string;
  alt_phone?: string;
  residential_address?: string;
  city?: string;
  region?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  emergency_contact_alt_phone?: string;
  emergency_contact_email?: string;
  emergency_contact_address?: string;
  previous_institution?: string;
  highest_qualification?: string;
  graduation_year?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
}

export interface StudentListResponse {
  items: StudentRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface StudentMetrics {
  total: number;
  ADMITTED: number;
  ENROLLED: number;
  ACTIVE: number;
  SUSPENDED: number;
  DEFERRED: number;
  WITHDRAWN: number;
  COMPLETED: number;
  GRADUATED: number;
  EXPELLED: number;
}

export interface EnrollmentRow {
  id: string;
  enrollment_number: string;
  student_id: string;
  index_number: string | null;
  program_id: string;
  program_title: string | null;
  campus_id: string | null;
  campus_name: string | null;
  intake_id: string;
  intake_name: string | null;
  session_name: string | null;
  admission_number: string | null;
  status: EnrollmentStatusValue;
  enrolled_at: string | null;
  confirmed_at: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  tuition_plan: string | null;
  notes: string | null;
}

export interface CampusRow {
  id: string;
  name: string;
  code: string;
  city: string | null;
  region: string | null;
  country: string | null;
  is_active: boolean;
}

export interface AcademicSessionRow {
  id: string;
  name: string;
  code: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

export interface IntakeRow {
  id: string;
  name: string;
  code: string;
  academic_session_id: string;
  session_name: string | null;
  application_opening_date: string | null;
  application_closing_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface ManualStudentCreated {
  student: StudentDetail;
  temporary_password: string;
}

export interface StudentCreatePayload {
  full_name: string;
  email: string;
  phone?: string;
  program_id: string;
  campus_id?: string;
  intake_id?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  residential_address?: string;
  city?: string;
  region?: string;
  country?: string;
}

export const studentsApi = {
  list(params: {
    search?: string;
    status?: string;
    campus_id?: string;
    intake_id?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<StudentListResponse> {
    return api<StudentListResponse>(`/students${qs(params)}`);
  },

  metrics(): Promise<StudentMetrics> {
    return api<StudentMetrics>("/students/metrics");
  },

  detail(studentId: string): Promise<StudentDetail> {
    return api<StudentDetail>(`/students/${studentId}`);
  },

  update(studentId: string, fields: Record<string, string>): Promise<StudentDetail> {
    return api<StudentDetail>(`/students/${studentId}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
  },

  changeStatus(studentId: string, status: StudentStatusValue, reason?: string): Promise<StudentDetail> {
    return api<StudentDetail>(`/students/${studentId}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason: reason ?? null }),
    });
  },

  exportUrl(params: { search?: string; status?: string } = {}): string {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
    return `${base}/students/export${qs(params)}`;
  },

  /** Admin: manually create a student (bypasses application flow). */
  create(payload: StudentCreatePayload): Promise<ManualStudentCreated> {
    return api<ManualStudentCreated>("/students", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Admin-issued temporary credential. Revokes the student's active sessions
   * and returns the one-time password so it can be handed over directly — the
   * reliable path when automated email/SMS delivery is unavailable.
   */
  resetCredentials(userId: string): Promise<{ temporary_password: string; must_change_password: boolean }> {
    return api(`/users/${userId}/password-reset`, { method: "POST" });
  },
};

export const enrollmentsApi = {
  list(params: { student_id?: string; status?: string } = {}): Promise<EnrollmentRow[]> {
    return api<EnrollmentRow[]>(`/enrollments${qs(params)}`);
  },

  create(payload: {
    student_id: string;
    intake_id: string;
    campus_id?: string;
    tuition_plan?: string;
    notes?: string;
  }): Promise<EnrollmentRow> {
    return api<EnrollmentRow>("/enrollments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  confirm(
    enrollmentId: string,
    payload: { start_date?: string; expected_completion_date?: string } = {}
  ): Promise<EnrollmentRow> {
    return api<EnrollmentRow>(`/enrollments/${enrollmentId}/confirm`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  changeStatus(enrollmentId: string, status: EnrollmentStatusValue, reason?: string): Promise<EnrollmentRow> {
    return api<EnrollmentRow>(`/enrollments/${enrollmentId}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason: reason ?? null }),
    });
  },
};

export const academicsApi = {
  campuses(): Promise<CampusRow[]> {
    return api<CampusRow[]>("/campuses");
  },

  createCampus(payload: {
    name: string;
    code: string;
    city?: string;
    region?: string;
    country?: string;
  }): Promise<CampusRow> {
    return api<CampusRow>("/campuses", { method: "POST", body: JSON.stringify(payload) });
  },

  sessions(): Promise<AcademicSessionRow[]> {
    return api<AcademicSessionRow[]>("/academic-sessions");
  },

  createSession(payload: {
    name: string;
    code: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<AcademicSessionRow> {
    return api<AcademicSessionRow>("/academic-sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  intakes(params: { status?: string } = {}): Promise<IntakeRow[]> {
    return api<IntakeRow[]>(`/intakes${qs(params)}`);
  },

  createIntake(payload: {
    name: string;
    code: string;
    academic_session_id: string;
    status?: string;
    application_opening_date?: string;
    application_closing_date?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<IntakeRow> {
    return api<IntakeRow>("/intakes", { method: "POST", body: JSON.stringify(payload) });
  },
};

export const myEnrollmentsApi = {
  list(): Promise<EnrollmentRow[]> {
    return api<EnrollmentRow[]>("/students/me/enrollments");
  },
};

/** Student self-service profile: read, update, and avatar upload. */
export const myProfileApi = {
  get(): Promise<StudentDetail> {
    return api<StudentDetail>("/students/me");
  },
  update(payload: StudentProfileUpdatePayload): Promise<StudentDetail> {
    return api<StudentDetail>("/students/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  uploadPhoto(file: File): Promise<StudentDetail> {
    const form = new FormData();
    form.append("file", file);
    return apiForm<StudentDetail>("/students/me/photo", form);
  },
};
