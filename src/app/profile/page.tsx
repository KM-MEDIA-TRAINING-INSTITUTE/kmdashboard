"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { FullPageSpinner } from "@/components/route-guard";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  myProfileApi,
  type StudentDetail,
  type StudentProfileUpdatePayload,
} from "@/lib/api/students";

/** One editable field on the profile form. */
interface FieldDef {
  name: keyof StudentProfileUpdatePayload;
  label: string;
  type?: string;
  placeholder?: string;
  options?: string[];
  digitsOnly?: boolean;
}

/** Fields the student can edit, grouped the way the form presents them. */
const GROUPS: { title: string; description?: string; keys: FieldDef[] }[] = [
  {
    title: "Account",
    description: "How the institute reaches you. Changing your name here updates it across the portal.",
    keys: [
      { name: "full_name", label: "Full name", placeholder: "As on your national ID" },
      { name: "phone", label: "Primary phone", type: "tel", placeholder: "e.g. 024 000 0000" },
    ],
  },
  {
    title: "Personal details",
    keys: [
      { name: "date_of_birth", label: "Date of birth", type: "date" },
      {
        name: "gender",
        label: "Gender",
        options: ["Female", "Male", "Other"],
      },
      { name: "nationality", label: "Nationality", placeholder: "e.g. Ghanaian" },
    ],
  },
  {
    title: "Contact & address",
    keys: [
      { name: "alt_phone", label: "Alternate phone", type: "tel" },
      { name: "residential_address", label: "Residential address", placeholder: "House / street / area" },
      { name: "city", label: "City / Town" },
      { name: "region", label: "Region" },
      { name: "country", label: "Country", placeholder: "Ghana" },
    ],
  },
  {
    title: "Emergency contact",
    description: "Who we call if something happens to you on campus.",
    keys: [
      { name: "emergency_contact_name", label: "Full name" },
      {
        name: "emergency_contact_relationship",
        label: "Relationship",
        placeholder: "e.g. Parent,Sibling,Spouse",
      },
      { name: "emergency_contact_phone", label: "Phone", type: "tel" },
      { name: "emergency_contact_alt_phone", label: "Alternate phone", type: "tel" },
      { name: "emergency_contact_email", label: "Email", type: "email" },
      { name: "emergency_contact_address", label: "Address" },
    ],
  },
  {
    title: "Academic background",
    description: "Optional — helps us understand where you are joining from.",
    keys: [
      { name: "previous_institution", label: "Previous institution" },
      { name: "highest_qualification", label: "Highest qualification", placeholder: "e.g. WASSCE, HND, BSc" },
      { name: "graduation_year", label: "Graduation year", digitsOnly: true, placeholder: "e.g. 2024" },
    ],
  },
];

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function initialsFrom(profile: StudentDetail | null, fallback: string): string {
  return profile?.full_name || fallback;
}

function ProfileInner() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<StudentDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hydrate = useCallback((p: StudentDetail) => {
    setProfile(p);
    const next: Record<string, string> = {};
    for (const g of GROUPS) {
      for (const k of g.keys) {
        const raw = (p as unknown as Record<string, unknown>)[k.name];
        next[k.name] = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
      }
    }
    setForm(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    myProfileApi
      .get()
      .then((p) => !cancelled && hydrate(p))
      .catch(() => !cancelled && setLoadError("Could not load your profile. Is the API running?"));
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  const dirty =
    profile !== null &&
    GROUPS.some((g) =>
      g.keys.some((k) => {
        const raw = (profile as unknown as Record<string, unknown>)[k.name];
        const server = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
        return (form[k.name] ?? "") !== server;
      })
    );

  const save = async () => {
    if (!profile || !dirty) return;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const payload: Record<string, string> = {};
      for (const g of GROUPS) {
        for (const k of g.keys) {
          const value = (form[k.name] ?? "").trim();
          if (value) payload[k.name] = value;
        }
      }
      const updated = await myProfileApi.update(payload as StudentProfileUpdatePayload);
      hydrate(updated);
      await refreshUser().catch(() => undefined);
      setNotice("Profile updated.");
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "Could not save your profile. Try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const onPickPhoto = async (file: File | undefined) => {
    if (!file || !profile) return;
    setSaveError(null);
    setNotice(null);
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      setSaveError("Profile photo must be a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setSaveError("Profile photo must be 2 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const updated = await myProfileApi.uploadPhoto(file);
      hydrate(updated);
      await refreshUser().catch(() => undefined);
      setNotice("Profile photo updated.");
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "Could not upload your photo. Try again."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!profile && !loadError) return <FullPageSpinner label="Loading your profile…" />;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep your details up to date — the office and your trainers rely on them.
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {profile && (
        <>
          {/* Read-only identity snapshot — these are issued, not editable. */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center gap-5">
              <Avatar name={initialsFrom(profile, user?.full_name ?? "?")} avatarUrl={profile.avatar_url} size={80} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-900">{profile.full_name ?? user?.full_name}</p>
                <p className="text-sm text-slate-500">{profile.email ?? user?.email}</p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Index: <span className="font-medium text-slate-700">{profile.index_number}</span></span>
                  {profile.admission_number && (
                    <span>Admission: <span className="font-medium text-slate-700">{profile.admission_number}</span></span>
                  )}
                  {profile.program_title && <span>Programme: {profile.program_title}</span>}
                  {profile.campus_name && <span>Campus: {profile.campus_name}</span>}
                </p>
              </div>
              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_PHOTO_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => void onPickPhoto(e.target.files?.[0])}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : profile.avatar_url ? "Change photo" : "Add photo"}
                </button>
                <p className="mt-1.5 max-w-[10rem] text-[11px] text-slate-400">
                  PNG, JPEG or WebP · up to 2 MB
                </p>
              </div>
            </div>
          </section>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-6"
          >
            {GROUPS.map((group) => (
              <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-slate-900">{group.title}</h2>
                {group.description && (
                  <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                )}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {group.keys.map((field) => (
                    <label key={field.name} className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">{field.label}</span>
                      {field.options ? (
                        <select
                          value={form[field.name] ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        >
                          <option value="">— select —</option>
                          {field.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type ?? "text"}
                          inputMode={field.digitsOnly ? "numeric" : undefined}
                          value={form[field.name] ?? ""}
                          placeholder={field.placeholder}
                          maxLength={field.digitsOnly ? 4 : 200}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              [field.name]: field.digitsOnly
                                ? e.target.value.replace(/\D/g, "")
                                : e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex items-center justify-end gap-3">
              {dirty && (
                <span className="mr-auto text-xs text-amber-600">You have unsaved changes.</span>
              )}
              <button
                type="submit"
                disabled={!dirty || saving}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RouteGuard allowedRoles={["STUDENT"]}>
      <AppShell>
        <ProfileInner />
      </AppShell>
    </RouteGuard>
  );
}
