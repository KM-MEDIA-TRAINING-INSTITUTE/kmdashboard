import { api, apiForm } from "./client";
import type {
  AdminPasswordResetResponse,
  SessionOut,
  StaffCreatePayload,
  StaffCreatedResponse,
  TokenPair,
  UserOut,
  UserStatusOut,
} from "./types";

export const authApi = {
  login(identifier: string, password: string): Promise<TokenPair> {
    return api<TokenPair>("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ identifier, password }),
    });
  },

  me(): Promise<UserOut> {
    return api<UserOut>("/auth/me");
  },

  logout(): Promise<void> {
    const refresh = safeRefresh();
    return api<void>("/auth/logout", {
      method: "POST",
      body: refresh ? JSON.stringify({ refresh_token: refresh }) : undefined,
    });
  },

  logoutAll(): Promise<void> {
    return api<void>("/auth/logout-all", { method: "POST" });
  },

  listSessions(): Promise<SessionOut[]> {
    return api<SessionOut[]>("/auth/sessions");
  },

  revokeSession(sessionId: string): Promise<void> {
    return api<void>(`/auth/sessions/${sessionId}`, { method: "DELETE" });
  },

  changePassword(payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> {
    return api<void>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  requestPasswordReset(identifier: string): Promise<string> {
    // Resolve to the response message — in dev the message carries the
    // single-use reset token when no mail provider is configured.
    return api<{ message: string }>("/auth/password-reset", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ identifier }),
    }).then((r) => r.message);
  },

  confirmPasswordReset(payload: {
    token: string;
    new_password: string;
    confirm_password: string;
  }): Promise<string> {
    return api<{ message: string }>("/auth/password-reset/confirm", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify(payload),
    }).then((r) => r.message);
  },
};

function safeRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("km.refresh_token");
}

/** Generic user profile update (all roles). */
export interface UserProfileUpdatePayload {
  full_name?: string;
  phone?: string;
}

/** Self-service profile: read, update, and avatar upload for any authenticated user. */
export const userProfileApi = {
  get(): Promise<UserOut> {
    return api<UserOut>("/auth/me");
  },
  update(payload: UserProfileUpdatePayload): Promise<UserOut> {
    return api<UserOut>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  uploadPhoto(file: File): Promise<UserOut> {
    const form = new FormData();
    form.append("file", file);
    return apiForm<UserOut>("/auth/me/photo", form);
  },
};

/** Staff & Trainer management API (admin-facing). */
export const staffApi = {
  list(params: {
    role?: string;
    exclude_role?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<UserOut[]> {
    const qs = new URLSearchParams();
    if (params.role) qs.set("role", params.role);
    if (params.exclude_role) qs.set("exclude_role", params.exclude_role);
    if (params.search) qs.set("search", params.search);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return api<UserOut[]>(`/users${q}`);
  },

  create(payload: StaffCreatePayload): Promise<StaffCreatedResponse> {
    return api<StaffCreatedResponse>("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  setStatus(userId: string, isActive: boolean, reason?: string): Promise<UserStatusOut> {
    return api<UserStatusOut>(`/users/${userId}/status`, {
      method: "POST",
      body: JSON.stringify({ is_active: isActive, reason }),
    });
  },

  resetPassword(userId: string): Promise<AdminPasswordResetResponse> {
    return api<AdminPasswordResetResponse>(`/users/${userId}/password-reset`, {
      method: "POST",
    });
  },

  sendCredentials(userId: string): Promise<AdminPasswordResetResponse> {
    return api<AdminPasswordResetResponse>(`/users/${userId}/send-credentials`, {
      method: "POST",
    });
  },

  updateRoles(userId: string, roles: string[]): Promise<UserOut> {
    return api<UserOut>(`/users/${userId}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roles }),
    });
  },

  updatePrograms(userId: string, programIds: string[]): Promise<UserOut> {
    return api<UserOut>(`/users/${userId}/programs`, {
      method: "PUT",
      body: JSON.stringify({ program_ids: programIds }),
    });
  },
};


