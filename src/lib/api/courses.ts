import { api } from "./client";

/**
 * Phase 5 academic content API surface.
 *
 * Permissions are enforced server-side (course:read / course:create /
 * course:update / course:review / course:delete / curriculum:manage, plus
 * object-level trainer ownership and student enrollment checks); the UI only
 * hides what the backend would refuse anyway.
 */

export type CourseStatusValue =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "PUBLISHED"
  | "ARCHIVED";

export type CourseType =
  | "CORE"
  | "ELECTIVE"
  | "PRACTICAL"
  | "WORKSHOP"
  | "PROJECT"
  | "GENERAL";

export type TrainerRole = "PRIMARY_TRAINER" | "CO_TRAINER" | "ASSISTANT";

export interface CourseTrainerInfo {
  user_id: string;
  name: string | null;
  email: string | null;
  role: TrainerRole;
}

export interface LessonSummary {
  id: string;
  title: string;
  content_type: string;
  duration_minutes: number | null;
  order_index: number;
  is_preview: boolean;
  completed?: boolean;
}

export interface ModuleSummary {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  lessons: LessonSummary[];
}

export interface CourseOut {
  id: string;
  course_code: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  department_id: string | null;
  department_name: string | null;
  learning_objectives: string[];
  course_type: CourseType;
  difficulty_level: string | null;
  credit_units: number | null;
  duration_weeks: number | null;
  status: CourseStatusValue;
  visibility: string;
  trainers: CourseTrainerInfo[];
  module_count: number;
  lesson_count: number;
  created_at: string | null;
  published_at: string | null;
  modules?: ModuleSummary[];
}

export interface CurriculumOut {
  id: string;
  name: string;
  code: string;
  program_id: string;
  program_title: string | null;
  academic_session_id: string;
  session_name: string | null;
  version: string;
  description: string | null;
  status: string;
  courses: CurriculumCourseRow[];
}

export interface CurriculumCourseRow {
  id?: string;
  course_id?: string;
  course_code?: string;
  course_title?: string;
  year_level?: number;
  term?: string | null;
  credit_units?: number | null;
  is_required?: boolean;
  display_order?: number;
  [key: string]: unknown;
}

export interface StudentCourseOut {
  course_id: string;
  course_code: string;
  title: string;
  short_description: string | null;
  trainer: string | null;
  curriculum: string | null;
  curriculum_id: string | null;
  year_level: number | null;
  term: string | null;
  is_required: boolean | null;
}

export interface StudentLessonOut {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content_type: string;
  content: string | null;
  duration_minutes: number | null;
  order_index: number;
  is_preview: boolean;
}

export interface StudentProgressOut {
  completed_lessons: number;
  [key: string]: unknown;
}

export interface LessonCompleteOut {
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
}

export type CurriculumStatusValue = "DRAFT" | "REVIEW" | "APPROVED" | "ACTIVE" | "RETIRED";

export const coursesApi = {
  list(params?: {
    mine?: boolean;
    search?: string;
    status?: CourseStatusValue;
    limit?: number;
    offset?: number;
  }): Promise<CourseOut[]> {
    const qs = new URLSearchParams();
    if (params?.mine) qs.set("mine", "true");
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api<CourseOut[]>(`/courses${suffix}`);
  },

  detail(courseId: string): Promise<CourseOut> {
    return api<CourseOut>(`/courses/${courseId}`);
  },

  create(payload: {
    title: string;
    course_code: string;
    description?: string;
    short_description?: string | null;
    learning_objectives?: string[];
    course_type?: CourseType;
    difficulty_level?: string | null;
    credit_units?: number | null;
    duration_weeks?: number | null;
  }): Promise<CourseOut> {
    return api<CourseOut>("/courses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update(
    courseId: string,
    payload: Partial<{
      title: string;
      description: string;
      short_description: string | null;
      learning_objectives: string[];
      course_type: CourseType;
      difficulty_level: string | null;
      credit_units: number | null;
      duration_weeks: number | null;
    }>
  ): Promise<CourseOut> {
    return api<CourseOut>(`/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  transition(
    courseId: string,
    action: "submit" | "start-review" | "approve" | "publish" | "archive"
  ): Promise<CourseOut> {
    return api<CourseOut>(`/courses/${courseId}/${action}`, { method: "POST" });
  },

  requestChanges(courseId: string, feedback: string): Promise<CourseOut> {
    return api<CourseOut>(`/courses/${courseId}/request-changes`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    });
  },

  assignTrainer(
    courseId: string,
    trainerId: string,
    role: TrainerRole = "PRIMARY_TRAINER"
  ): Promise<CourseOut> {
    return api<CourseOut>(`/courses/${courseId}/trainers`, {
      method: "POST",
      body: JSON.stringify({ trainer_id: trainerId, role }),
    });
  },

  addModule(courseId: string, title: string, description?: string): Promise<CourseOut> {
    return api<CourseOut>(`/courses/${courseId}/modules`, {
      method: "POST",
      body: JSON.stringify({ title, description: description ?? null }),
    });
  },

  updateModule(
    moduleId: string,
    payload: { title?: string; description?: string | null }
  ): Promise<CourseOut> {
    return api<CourseOut>(`/courses/modules/${moduleId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  reorderModule(moduleId: string, orderIndex: number): Promise<CourseOut> {
    return api<CourseOut>(`/courses/modules/${moduleId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ order_index: orderIndex }),
    });
  },

  deleteModule(moduleId: string): Promise<{ deleted: boolean }> {
    return api<{ deleted: boolean }>(`/courses/modules/${moduleId}`, {
      method: "DELETE",
    });
  },

  addLesson(
    moduleId: string,
    payload: {
      title: string;
      content_type?: string;
      content?: string;
      description?: string | null;
      duration_minutes?: number | null;
      is_preview?: boolean;
    }
  ): Promise<StudentLessonOut> {
    return api<StudentLessonOut>(`/courses/modules/${moduleId}/lessons`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateLesson(
    lessonId: string,
    payload: {
      title?: string;
      description?: string | null;
      content_type?: string;
      content?: string;
      duration_minutes?: number | null;
      is_preview?: boolean;
    }
  ): Promise<StudentLessonOut> {
    return api<StudentLessonOut>(`/courses/lessons/${lessonId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  reorderLesson(lessonId: string, orderIndex: number): Promise<{ reordered: boolean }> {
    return api<{ reordered: boolean }>(`/courses/lessons/${lessonId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ order_index: orderIndex }),
    });
  },

  deleteLesson(lessonId: string): Promise<{ deleted: boolean }> {
    return api<{ deleted: boolean }>(`/courses/lessons/${lessonId}`, {
      method: "DELETE",
    });
  },
};

export const curriculaApi = {
  list(): Promise<CurriculumOut[]> {
    return api<CurriculumOut[]>("/curricula");
  },

  create(payload: {
    name: string;
    code: string;
    program_id: string;
    academic_session_id: string;
    version?: string;
    description?: string | null;
  }): Promise<CurriculumOut> {
    return api<CurriculumOut>("/curricula", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  addCourse(
    curriculumId: string,
    courseId: string,
    extra?: { year_level?: number; term?: string | null; credit_units?: number | null; is_required?: boolean }
  ): Promise<CurriculumOut> {
    return api<CurriculumOut>(`/curricula/${curriculumId}/courses`, {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, ...extra }),
    });
  },

  approve(curriculumId: string): Promise<CurriculumOut> {
    return api<CurriculumOut>(`/curricula/${curriculumId}/approve`, { method: "POST" });
  },

  activate(curriculumId: string): Promise<CurriculumOut> {
    return api<CurriculumOut>(`/curricula/${curriculumId}/activate`, { method: "POST" });
  },
};

export const studentCoursesApi = {
  myCourses(): Promise<StudentCourseOut[]> {
    return api<StudentCourseOut[]>("/student/courses");
  },

  courseDetail(courseId: string): Promise<CourseOut & { modules: ModuleSummary[] }> {
    return api(`/student/courses/${courseId}`);
  },

  lesson(lessonId: string): Promise<StudentLessonOut> {
    return api<StudentLessonOut>(`/student/lessons/${lessonId}`);
  },

  completeLesson(lessonId: string): Promise<LessonCompleteOut> {
    return api<LessonCompleteOut>(`/student/lessons/${lessonId}/complete`, {
      method: "POST",
    });
  },

  progress(): Promise<StudentProgressOut> {
    return api<StudentProgressOut>("/student/progress");
  },
};

export interface ProgramFull {
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
  requirements: string; // JSON-encoded string[]
  opportunities: string; // JSON-encoded string[]
  modules: string; // JSON-encoded string[]
  is_active: boolean;
  accepting_applications: boolean;
  created_at: string;
}

export interface ProgramWritePayload {
  title?: string;
  description?: string;
  long_description?: string;
  category?: string;
  duration_weeks?: number | null;
  certificate?: string | null;
  tuition_minor?: number | null;
  application_fee_minor?: number;
  requirements?: string[];
  opportunities?: string[];
  modules?: string[];
  is_active?: boolean;
  accepting_applications?: boolean;
}

export const programsApi = {
  list(): Promise<Array<{ id: string; slug: string; code: string; title: string; tuition_minor?: number | null }>> {
    return api("/programs");
  },

  // Admin view: every programme including inactive ones.
  manageList(): Promise<ProgramFull[]> {
    return api<ProgramFull[]>("/programs/manage");
  },

  create(payload: ProgramWritePayload & { slug: string; code: string; title: string; category: string }): Promise<ProgramFull> {
    return api<ProgramFull>("/programs", { method: "POST", body: JSON.stringify(payload) });
  },

  update(slug: string, payload: ProgramWritePayload): Promise<ProgramFull> {
    return api<ProgramFull>(`/programs/${slug}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
};

export const COURSE_STATUS_META: Record<
  CourseStatusValue,
  { label: string; classes: string }
> = {
  DRAFT: { label: "Draft", classes: "bg-slate-100 text-slate-600" },
  SUBMITTED: { label: "Submitted", classes: "bg-blue-100 text-blue-700" },
  UNDER_REVIEW: { label: "Under review", classes: "bg-amber-100 text-amber-800" },
  CHANGES_REQUESTED: { label: "Changes requested", classes: "bg-orange-100 text-orange-800" },
  APPROVED: { label: "Approved", classes: "bg-emerald-100 text-emerald-700" },
  PUBLISHED: { label: "Published", classes: "bg-teal-100 text-teal-800" },
  ARCHIVED: { label: "Archived", classes: "bg-slate-200 text-slate-500" },
};

/** Progress the trainer can drive; admin-only steps return 403 for trainers. */
export const TRAINER_STATUS_ACTIONS: Record<
  CourseStatusValue,
  { action: "submit"; label: string } | null
> = {
  DRAFT: { action: "submit", label: "Submit for review" },
  SUBMITTED: null,
  UNDER_REVIEW: null,
  CHANGES_REQUESTED: null,
  APPROVED: null,
  PUBLISHED: null,
  ARCHIVED: null,
};
