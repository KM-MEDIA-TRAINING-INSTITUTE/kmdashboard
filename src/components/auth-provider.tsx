"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi } from "@/lib/api/endpoints";
import { tokenStore } from "@/lib/api/token-store";
import type { Role, TokenPair, UserSummary } from "@/lib/api/types";

type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: UserSummary | null;
  login: (identifier: string, password: string) => Promise<TokenPair>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserSummary | null>(null);

  // Restore the session on first mount: a stored access token may still be
  // valid; otherwise the client silently rotates the refresh token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
        setStatus("guest");
        return;
      }
      try {
        const me = await authApi.me();
        if (cancelled) return;
        setUser({
          id: me.id,
          email: me.email,
          full_name: me.full_name,
          roles: me.roles,
          must_change_password: me.must_change_password,
          avatar_url: me.avatar_url ?? null,
          assigned_programs: me.assigned_programs ?? [],
        });
        setStatus("authenticated");
      } catch {
        if (cancelled) return;
        tokenStore.clear();
        setStatus("guest");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const pair = await authApi.login(identifier, password);
    tokenStore.set(pair);
    setUser(pair.user);
    setStatus("authenticated");
    return pair;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Server-side cleanup is best-effort; local teardown always happens.
    }
    tokenStore.clear();
    setUser(null);
    setStatus("guest");
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await authApi.me();
    setUser({
      id: me.id,
      email: me.email,
      full_name: me.full_name,
      roles: me.roles,
      must_change_password: me.must_change_password,
      avatar_url: me.avatar_url ?? null,
      assigned_programs: me.assigned_programs ?? [],
    });
  }, []);

  const value = useMemo(
    () => ({ status, user, login, logout, refreshUser }),
    [status, user, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Landing route per role once authenticated — resolves the PRIMARY
 * dashboard by role precedence (Phase 8 §85). Multi-role users land on the
 * highest-precedence dashboard and see navigation for every role they hold;
 * switching areas is navigation only, never a permission change — the
 * backend re-authorizes every request. */
export function homeForRole(roles: Role[]): string {
  if (roles.includes("SUPERADMIN")) return "/dashboard/superadmin";
  if (roles.includes("ADMIN")) return "/dashboard/admin";
  if (roles.includes("TRAINER")) return "/dashboard/trainer";
  if (roles.includes("STUDENT")) return "/dashboard/student";
  return "/student";
}

/** Checks whether a user with the given roles is permitted to access a given path. */
export function canRoleAccessRoute(roles: Role[], path: string | null | undefined): boolean {
  if (!path || path === "/" || path === "/login") return true;

  // Strip query string and hash
  const clean = path.split("?")[0].split("#")[0];

  // Admin section: strictly requires ADMIN or SUPERADMIN
  if (clean.startsWith("/admin") || clean.startsWith("/dashboard/admin")) {
    return roles.includes("ADMIN") || roles.includes("SUPERADMIN");
  }

  // Superadmin dashboard: strictly requires SUPERADMIN
  if (clean.startsWith("/dashboard/superadmin")) {
    return roles.includes("SUPERADMIN");
  }

  // Trainer dashboard and teaching workspace
  if (clean.startsWith("/trainer") || clean.startsWith("/dashboard/trainer")) {
    return (
      roles.includes("TRAINER") ||
      roles.includes("ADMIN") ||
      roles.includes("SUPERADMIN")
    );
  }

  // Student dashboard: requires STUDENT, ADMIN, or SUPERADMIN
  if (clean.startsWith("/dashboard/student")) {
    return (
      roles.includes("STUDENT") ||
      roles.includes("ADMIN") ||
      roles.includes("SUPERADMIN")
    );
  }

  // Student workspace
  if (clean.startsWith("/student")) {
    return (
      roles.includes("STUDENT") ||
      roles.includes("ADMIN") ||
      roles.includes("SUPERADMIN")
    );
  }

  // Common authenticated routes (profile, sessions, change-password)
  return true;
}
