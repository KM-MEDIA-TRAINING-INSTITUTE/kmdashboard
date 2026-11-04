"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { homeForRole, useAuth } from "@/components/auth-provider";
import type { Role } from "@/lib/api/types";

/**
 * Client-side guard for authenticated areas. The backend remains the
 * authority — this only routes; every API call is still authorized
 * server-side per request.
 *
 * - guest          → /login?next=<path>
 * - must_change_password → /change-password (mandatory first-login change)
 * - allowedRoles   → 403 panel when the user holds none of them
 */
export function RouteGuard({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: Role[];
}) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "guest") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  useEffect(() => {
    if (status === "authenticated" && user?.must_change_password) {
      if (pathname !== "/change-password") {
        router.replace("/change-password");
      }
    }
  }, [status, user, pathname, router]);

  if (status !== "authenticated" || !user) {
    return <FullPageSpinner label="Checking your session…" />;
  }

  if (allowedRoles && !allowedRoles.some((r) => user.roles.includes(r))) {
    return (
      <main className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-lg font-semibold text-red-800">Access denied</h1>
          <p className="mt-2 text-sm text-red-700">
            Your roles ({user.roles.join(", ")}) do not grant access to this
            area.
          </p>
          <button
            onClick={() => router.replace(homeForRole(user.roles))}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Go to my workspace
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

export function FullPageSpinner({ label }: { label: string }) {
  return (
    <main className="grid min-h-dvh place-items-center">
      <div className="flex items-center gap-3 text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        <span className="text-sm">{label}</span>
      </div>
    </main>
  );
}
