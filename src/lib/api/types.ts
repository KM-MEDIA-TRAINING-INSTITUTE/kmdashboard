export type Role = "SUPERADMIN" | "ADMIN" | "TRAINER" | "STUDENT";

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  must_change_password: boolean;
  avatar_url?: string | null;
}

/** Payload of POST /auth/login and POST /auth/refresh. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  must_change_password: boolean;
  user: UserSummary;
}

export interface ProgramBrief {
  id: string;
  slug: string;
  code: string;
  title: string;
}

/** Payload of GET /auth/me and GET /users. */
export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  must_change_password: boolean;
  roles: Role[];
  assigned_programs?: ProgramBrief[];
  created_at?: string | null;
}

export interface StaffCreatePayload {
  email: string;
  full_name: string;
  phone?: string;
  role?: Role;
  default_password?: string;
  program_ids?: string[];
}

export interface StaffCreatedResponse {
  user: UserOut;
  temporary_password: string;
}

export interface AdminPasswordResetResponse {
  temporary_password: string;
}

export interface UserStatusOut {
  id: string;
  email: string;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
}

export interface SessionOut {
  id: string;
  device_name: string | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  is_current: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { errors?: Array<{ loc?: (string | number)[]; msg?: string }> };
  };
}

/** Error thrown by the api client; message is human-readable. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: ApiErrorBody["error"]["details"];

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error?.message ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code ?? "unknown";
    this.details = body?.error?.details;
  }
}
