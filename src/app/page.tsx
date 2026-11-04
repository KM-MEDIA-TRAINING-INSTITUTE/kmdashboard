"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullPageSpinner } from "@/components/route-guard";
import { homeForRole, useAuth } from "@/components/auth-provider";

/** Entry point: send authenticated users to their workspace, others to login. */
export default function HomePage() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "guest") router.replace("/login");
    if (status === "authenticated" && user) {
      router.replace(
        user.must_change_password ? "/change-password" : homeForRole(user.roles)
      );
    }
  }, [status, user, router]);

  return <FullPageSpinner label="Loading…" />;
}
