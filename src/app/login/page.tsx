"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { FullPageSpinner } from "@/components/route-guard";
import { canRoleAccessRoute, homeForRole, useAuth } from "@/components/auth-provider";
import { MOTION_EASE } from "@/components/ui/motion";
import { ApiError } from "@/lib/api/client";
import type { Role } from "@/lib/api/types";

const REASON_BANNERS: Record<string, string> = {
  expired: "Your session expired. Please sign in again.",
  reused:
    "Your session was revoked for security reasons (token reuse detected). Please sign in again.",
};

function LoginForm() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = params.get("next");
  const reason = params.get("reason");

  const landingFor = (mustChange: boolean, home: string, roles: Role[]) => {
    if (mustChange) return "/change-password";
    if (next && next !== "/login") {
      if (canRoleAccessRoute(roles, next)) {
        const dash = next.match(/^\/dashboard\/([a-z]+)/);
        if (!dash || next === home) return next;
      }
    }
    return home;
  };

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(landingFor(user.must_change_password, homeForRole(user.roles), user.roles));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user, next, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const pair = await login(identifier.trim(), password);
      router.replace(
        landingFor(pair.must_change_password, homeForRole(pair.user.roles), pair.user.roles)
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the API running?"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh bg-[#f6f8fb] lg:grid-cols-2">
      {/* Left brand panel (desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900 p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-3">
          <Image
            src="/images/logo.jpeg"
            alt="KM Media Training Institute logo"
            width={44}
            height={44}
            priority
            className="h-11 w-11 rounded-xl bg-white object-contain shadow-sm ring-1 ring-white/20"
          />
          <div>
            <p className="text-base font-bold tracking-tight text-white">
              KM Media Training Institute
            </p>
            <p className="text-xs font-medium text-brand-300">Learn. Create. Lead.</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Education Management Platform
          </div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
            One unified workspace for students, instructors, and administration.
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Manage admissions, academic programmes, live classes, attendance, assessments, and
            tuition finance in one modern portal.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-300">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-semibold text-white">Media Programmes</p>
              <p className="mt-1 text-slate-400">Broadcast Journalism · Cinematography · DJ</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-semibold text-white">Tech &amp; Innovation</p>
              <p className="mt-1 text-slate-400">Web &amp; Mobile · Product Design · Robotics</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-400">
          dashboard.kmmediatraininginstitute.com
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: MOTION_EASE }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 text-center lg:text-left">
            <Image
              src="/images/logo.jpeg"
              alt="KM Media Training Institute logo"
              width={56}
              height={56}
              priority
              className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-white object-contain shadow-sm ring-1 ring-brand-100 lg:hidden"
            />
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to your KM Media account to continue.
            </p>
          </div>

          {reason && REASON_BANNERS[reason] && (
            <div
              className={`mb-4 rounded-xl border p-3.5 text-xs font-medium ${
                reason === "reused"
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-brand-200 bg-brand-50 text-brand-900"
              }`}
            >
              {REASON_BANNERS[reason]}
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-card)]"
          >
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold text-ink-800">
                Email, phone, or index number
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold text-ink-800">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm text-ink-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-slate-400 hover:text-ink-800 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
              {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Applied for a programme?{" "}
            <Link href="/track" className="font-semibold text-brand-600 hover:underline">
              Track your application →
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageSpinner label="Loading…" />}>
      <LoginForm />
    </Suspense>
  );
}
