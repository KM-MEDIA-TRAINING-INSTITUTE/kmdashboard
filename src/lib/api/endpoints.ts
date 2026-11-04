import { api } from "./client";
import type { SessionOut, TokenPair, UserOut } from "./types";

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
