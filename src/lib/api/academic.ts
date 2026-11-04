import { api } from "./client";

/**
 * Phase 7 academic delivery API surface.
 *
 * Permissions are enforced server-side (offering:*, class_session:*,
 * attendance:*, assignment:*, assessment:*, gradebook:*, grade:*,
 * result:*, progress:*, report:*); the UI only hides what the backend would
 * refuse anyway. Scores/attendance/progress shown here always come from the
 * backend's derived values — never computed client-side.
 */

export type OfferingStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "ARCHIVED";
export type DeliveryMode = "OFFLINE" | "ONLINE" | "HYBRID";
export type ClassSessionStatus =
  | "SCHEDULED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULED";
export type AttendanceStatusValue = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "REMOTE";

export interface OfferingTrainer {
  id: string;
  trainer_id: string;
  name: string | null;
  email: string | null;
  role: "PRIMARY" | "ASSISTANT" | "GUEST";
  status: string;
}

export interface Offering {
  id: string;
  code: string;
  course_id: string;
  program_id: string;
  academic_session_id: string;
  campus_id: string | null;
  intake_id: string | null;
  start_date: string | null;
  end_date: string | null;
  capacity: number;
  delivery_mode: DeliveryMode;
  location: string | null;
  meeting_url: string | null;
  meeting_provider: string | null;
  status: OfferingStatus;
  trainers: OfferingTrainer[];
  created_at: string;
}

export interface ClassSession {
  id: string;
  course_offering_id: string;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  delivery_mode: DeliveryMode;
  location: string | null;
  meeting_url: string | null;
  meeting_provider: string | null;
  module_id: string | null;
  lesson_id: string | null;
  trainer_id: string | null;
  status: ClassSessionStatus;
  rescheduled_to_session_id: string | null;
  attendance_locked_at: string | null;
  notes: string | null;
}

export interface RosterRow {
  student_id: string;
  name: string | null;
  index_number: string | null;
  status: AttendanceStatusValue | null;
  notes: string | null;
  recorded_at: string | null;
}

export interface AttendanceStats {
  total_sessions?: number;
  marked?: number;
  attended?: number;
  absent?: number;
  late?: number;
  excused?: number;
  attendance_rate?: number | null;
}

export interface AttendanceAnalyticsRow extends AttendanceStats {
  student_id: string;
  name: string | null;
  index_number: string | null;
  alert: "CRITICAL" | "WARNING" | "OK" | "NO_DATA";
}

export interface Assignment {
  id: string;
  course_offering_id: string;
  title: string;
  description: string | null;
  instructions: string;
  total_marks: number;
  passing_marks: number;
  due_at: string | null;
  available_from: string | null;
  allow_late_submission: boolean;
  late_penalty_type: "PERCENT_PER_DAY" | "FLAT_MARKS";
  late_penalty_value: number;
  max_attempts: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  published_at: string | null;
  module_id: string | null;
  lesson_id: string | null;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  attempt_number: number;
  content: string | null;
  storage_key: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  submitted_at: string | null;
  is_late: boolean;
  status: string;
  raw_score: number | null;
  penalty_marks: number;
  final_score: number | null;
  feedback: string | null;
  graded_at: string | null;
}

export interface AssessmentQuestionDto {
  id: string;
  question_type: string;
  prompt: string;
  help_text: string | null;
  marks: number;
  order_index: number;
  is_required: boolean;
  options?: { id: string; option_text: string; is_correct?: boolean }[];
  model_answer?: string | null;
}

export interface Assessment {
  id: string;
  course_offering_id: string;
  title: string;
  description: string | null;
  assessment_type: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number | null;
  available_from: string | null;
  available_until: string | null;
  max_attempts: number;
  status: string;
  questions?: AssessmentQuestionDto[];
  my_attempts?: Attempt[];
}

export interface Attempt {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  status: string;
  score: number | null;
  percentage: number | null;
  time_spent_seconds: number | null;
}

export interface GradebookRow {
  student_id: string;
  weighted: number;
  components: Record<string, number>;
}

export interface StudentResult {
  id: string;
  course_offering_id: string;
  course_title: string | null;
  course_code: string | null;
  percentage: number | null;
  letter_grade: string | null;
  grade_point: number | null;
  is_pass: boolean;
  release_state: string;
  published_at: string | null;
}

export interface ProgressMetrics {
  course_offering_id: string;
  lessons_total: number;
  lessons_completed: number;
  content_progress: number;
  assignments_published: number;
  assignments_submitted: number;
  assessments_total: number;
  assessments_attempted: number;
  assessments_passed: number;
  sessions_total: number;
  sessions_attended: number;
  attendance?: AttendanceStats;
}

export interface CalendarEvent {
  event_type: "CLASS" | "ASSIGNMENT_DUE" | "ASSESSMENT_AVAILABLE";
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  course_offering_id: string | null;
  course_title: string | null;
  delivery_mode: string | null;
  location: string | null;
  meeting_url: string | null;
  status: string | null;
}

export const offeringsApi = {
  list: () => api<Offering[]>("/course-offerings"),
  mine: () => api<Offering[]>("/course-offerings/mine"),
  get: (id: string) => api<Offering>(`/course-offerings/${id}`),
  create: (body: Partial<Offering> & { course_id: string; program_id: string; academic_session_id: string }) =>
    api<Offering>("/course-offerings", { method: "POST", body: JSON.stringify(body) }),
  assignTrainer: (id: string, trainer_id: string, role: string = "PRIMARY") =>
    api<Offering>(`/course-offerings/${id}/trainers`, {
      method: "POST",
      body: JSON.stringify({ trainer_id, role }),
    }),
  sessions: (id: string) => api<ClassSession[]>(`/course-offerings/${id}/sessions`),
  createSession: (id: string, body: Record<string, unknown>) =>
    api<ClassSession>(`/course-offerings/${id}/sessions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  attendanceAnalytics: (id: string) => api<AttendanceAnalyticsRow[]>(`/course-offerings/${id}/attendance`),
  gradebook: (id: string) =>
    api<{
      course_offering_id: string;
      state: string;
      components: { kind: string; ref_id?: string | null; label?: string | null; weight: number }[];
      totals: Record<string, GradebookRow>;
    }>(`/course-offerings/${id}/gradebook`),
  setComponents: (
    id: string,
    components: { kind: string; ref_id?: string | null; label?: string | null; weight: number }[]
  ) =>
    api<{ state: string }>(`/course-offerings/${id}/gradebook/components`, {
      method: "POST",
      body: JSON.stringify({ components }),
    }),
  gradebookStatus: (id: string, action: string, reason?: string) =>
    api<{ state: string }>(`/course-offerings/${id}/gradebook/status`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    }),
  publishResults: (id: string, provisional = false) =>
    api<unknown[]>(`/course-offerings/${id}/results/publish`, {
      method: "POST",
      body: JSON.stringify({ provisional }),
    }),
  assignments: (id: string) => api<Assignment[]>(`/course-offerings/${id}/assignments`),
  assessments: (id: string) => api<Assessment[]>(`/course-offerings/${id}/assessments`),
};

export const sessionsApi = {
  roster: (id: string) => api<RosterRow[]>(`/class-sessions/${id}/attendance`),
  mark: (id: string, records: { student_id: string; status: AttendanceStatusValue; notes?: string }[]) =>
    api<unknown[]>(`/class-sessions/${id}/attendance`, {
      method: "POST",
      body: JSON.stringify({ records }),
    }),
  lock: (id: string) => api<{ message: string }>(`/class-sessions/${id}/attendance/lock`, { method: "POST" }),
  unlock: (id: string, reason: string) =>
    api<{ message: string }>(`/class-sessions/${id}/attendance/unlock`, {
      method: "POST",
      body: JSON.stringify({ status: reason }),
    }),
  setStatus: (id: string, status: string) =>
    api<ClassSession>(`/class-sessions/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  cancel: (id: string, reason: string) =>
    api<ClassSession>(`/class-sessions/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ status: reason }),
    }),
};

export const assignmentsApi = {
  submissions: (id: string) => api<Submission[]>(`/assignments/${id}/submissions`),
  grade: (submissionId: string, score: number, feedback?: string) =>
    api<Submission>(`/assignments/submissions/${submissionId}/grade`, {
      method: "POST",
      body: JSON.stringify({ score, feedback }),
    }),
  publish: (id: string) => api<Assignment>(`/assignments/${id}/publish`, { method: "POST" }),
  close: (id: string) => api<Assignment>(`/assignments/${id}/close`, { method: "POST" }),
  create: (offeringId: string, body: Record<string, unknown>) =>
    api<Assignment>(`/course-offerings/${offeringId}/assignments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const assessmentsApi = {
  create: (offeringId: string, body: Record<string, unknown>) =>
    api<Assessment>(`/course-offerings/${offeringId}/assessments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  addQuestion: (id: string, body: Record<string, unknown>) =>
    api<{ id: string }>(`/assessments/${id}/questions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  publish: (id: string) => api<{ status: string }>(`/assessments/${id}/publish`, { method: "POST" }),
  open: (id: string) => api<{ status: string }>(`/assessments/${id}/open`, { method: "POST" }),
  close: (id: string) => api<{ status: string }>(`/assessments/${id}/close`, { method: "POST" }),
  attempts: (id: string) => api<Attempt[]>(`/assessments/${id}/attempts`),
  gradeAttempt: (attemptId: string, question_marks: Record<string, number>) =>
    api<Attempt>(`/assessment-attempts/${attemptId}/grade`, {
      method: "POST",
      body: JSON.stringify({ question_marks }),
    }),
};

/** Slim offering view for students (GET /student/offerings) — no trainer
 * roster or meeting links; those stay staff-side. */
export interface StudentOffering {
  id: string;
  code: string;
  course_id: string;
  program_id: string;
  status: string;
  delivery_mode: string;
  start_date: string | null;
  end_date: string | null;
  course_title: string | null;
}

export const studentApi = {
  /** The signed-in student's entitled offerings (dashboard scoping rules). */
  offerings: () => api<StudentOffering[]>("/student/offerings"),
  assignments: (offeringId: string) => api<Assignment[]>(`/student/offerings/${offeringId}/assignments`),
  submitAssignment: (assignmentId: string, body: { content?: string; file_name?: string; file_mime?: string; file_size?: number }) =>
    api<Submission>(`/student/assignments/${assignmentId}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  mySubmissions: (assignmentId: string) => api<Submission[]>(`/student/assignments/${assignmentId}/submissions`),
  assessments: (offeringId: string) => api<Assessment[]>(`/student/offerings/${offeringId}/assessments`),
  assessment: (id: string) => api<Assessment>(`/student/assessments/${id}`),
  startAttempt: (assessmentId: string) =>
    api<Attempt>(`/student/assessments/${assessmentId}/attempts`, { method: "POST" }),
  saveAnswer: (attemptId: string, body: { question_id: string; selected_option_ids?: string[]; answer_text?: string }) =>
    api<{ question_id: string }>(`/student/assessment-attempts/${attemptId}/answers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  submitAttempt: (attemptId: string) =>
    api<Attempt>(`/student/assessment-attempts/${attemptId}/submit`, { method: "POST" }),
  attempt: (attemptId: string) => api<Attempt & { answers: unknown[] }>(`/student/assessment-attempts/${attemptId}`),
  attendance: () => api<Record<string, unknown>[]>("/student/attendance"),
  results: () => api<StudentResult[]>("/student/results"),
  progress: (offeringId: string) => api<ProgressMetrics>(`/student/progress/${offeringId}`),
  completion: (offeringId: string) => api<Record<string, unknown>>(`/student/completion/${offeringId}`),
  calendar: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("date_from", from);
    if (to) q.set("date_to", to);
    const suffix = q.toString() ? `?${q}` : "";
    return api<CalendarEvent[]>(`/student/calendar${suffix}`);
  },
};

export const reportsApi = {
  attendance: () => api<Record<string, unknown>[]>("/reports/attendance"),
};

export function formatPercent(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v.toFixed(1)}%`;
}

export const attendanceStatusMeta: Record<AttendanceStatusValue, { label: string; className: string }> = {
  PRESENT: { label: "Present", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ABSENT: { label: "Absent", className: "bg-red-50 text-red-700 border-red-200" },
  LATE: { label: "Late", className: "bg-amber-50 text-amber-700 border-amber-200" },
  EXCUSED: { label: "Excused", className: "bg-sky-50 text-sky-700 border-sky-200" },
  REMOTE: { label: "Remote", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

export const sessionStatusMeta: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: "Scheduled", className: "bg-slate-100 text-slate-700 border-slate-200" },
  ONGOING: { label: "Ongoing", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  COMPLETED: { label: "Completed", className: "bg-sky-50 text-sky-700 border-sky-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
  RESCHEDULED: { label: "Rescheduled", className: "bg-amber-50 text-amber-700 border-amber-200" },
};
