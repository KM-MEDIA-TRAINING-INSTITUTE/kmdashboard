"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/api/finance";
import { programsApi, type ProgramFull } from "@/lib/api/courses";

/**
 * Admin → Programmes — create and edit the programme catalogue.
 * This is the source of truth for the public website's programme list:
 * saves here appear on the landing site immediately (active programmes only).
 */

interface FormState {
  slug: string;
  code: string;
  title: string;
  category: string;
  certificate: string;
  duration_weeks: string;
  tuition_cedis: string;
  application_fee_cedis: string;
  description: string;
  long_description: string;
  requirements: string; // one per line
  opportunities: string; // one per line
  modules: string; // one per line
  is_active: boolean;
  accepting_applications: boolean;
}

const EMPTY_FORM: FormState = {
  slug: "",
  code: "",
  title: "",
  category: "",
  certificate: "Certificate of Completion",
  duration_weeks: "",
  tuition_cedis: "",
  application_fee_cedis: "50",
  description: "",
  long_description: "",
  requirements: "",
  opportunities: "",
  modules: "",
  is_active: true,
  accepting_applications: true,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** The API stores requirements/opportunities/modules as JSON-encoded string arrays. */
function parseList(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toLines(items: string[]): string {
  return items.join("\n");
}

function fromLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function toMinor(cedis: string): number | null {
  const n = parseFloat(cedis.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function toCedis(minor: number | null | undefined): string {
  return minor == null ? "" : (minor / 100).toFixed(2);
}

function ProgramFormDialog({
  open,
  editing,
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: ProgramFull | null; // null = create
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowValidation(false);
    if (editing) {
      setForm({
        slug: editing.slug,
        code: editing.code,
        title: editing.title,
        category: editing.category,
        certificate: editing.certificate ?? "",
        duration_weeks: editing.duration_weeks == null ? "" : String(editing.duration_weeks),
        tuition_cedis: toCedis(editing.tuition_minor),
        application_fee_cedis: toCedis(editing.application_fee_minor),
        description: editing.description ?? "",
        long_description: editing.long_description ?? "",
        requirements: toLines(parseList(editing.requirements)),
        opportunities: toLines(parseList(editing.opportunities)),
        modules: toLines(parseList(editing.modules)),
        is_active: editing.is_active,
        accepting_applications: editing.accepting_applications,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editing]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const input = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
  const label = "block text-xs font-medium text-slate-600 mb-1";

  const invalid =
    !form.title.trim() ||
    (!editing && (!form.slug.trim() || !form.code.trim() || !form.category.trim())) ||
    toMinor(form.tuition_cedis) == null ||
    toMinor(form.application_fee_cedis) == null;

  const submit = () => {
    if (invalid) {
      setShowValidation(true);
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {editing ? `Edit programme — ${editing.title}` : "New programme"}
          </h2>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Close
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Saving publishes to the website immediately when the programme is active.
        </p>

        {(error || showValidation && invalid) && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error ?? "Title, slug, code, category and both amounts are required (amounts ≥ 0)."}
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Title *</label>
            <input
              className={input}
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!editing) set("slug", slugify(e.target.value));
              }}
            />
          </div>
          <div>
            <label className={label}>Slug * {editing ? "(fixed)" : ""}</label>
            <input
              className={`${input} ${editing ? "bg-slate-100 text-slate-500" : ""}`}
              value={form.slug}
              onChange={(e) => set("slug", slugify(e.target.value))}
              disabled={!!editing}
            />
          </div>
          <div>
            <label className={label}>Code *</label>
            <input
              className={input}
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              disabled={!!editing}
              maxLength={10}
            />
          </div>
          <div>
            <label className={label}>Category *</label>
            <input
              className={input}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              disabled={!!editing}
            />
          </div>
          <div>
            <label className={label}>Certificate</label>
            <input className={input} value={form.certificate} onChange={(e) => set("certificate", e.target.value)} />
          </div>
          <div>
            <label className={label}>Duration (weeks)</label>
            <input
              className={input}
              value={form.duration_weeks}
              onChange={(e) => set("duration_weeks", e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className={label}>Application fee (GHS) *</label>
            <input className={input} value={form.application_fee_cedis} onChange={(e) => set("application_fee_cedis", e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className={label}>Tuition (GHS) *</label>
            <input className={input} value={form.tuition_cedis} onChange={(e) => set("tuition_cedis", e.target.value)} inputMode="decimal" />
          </div>
          <div className="flex items-center gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              Active (listed on website)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.accepting_applications}
                onChange={(e) => set("accepting_applications", e.target.checked)}
              />
              Accepting applications
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Short description</label>
            <textarea className={input} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Long description (shown in the website modal)</label>
            <textarea className={input} rows={3} value={form.long_description} onChange={(e) => set("long_description", e.target.value)} />
          </div>
          <div>
            <label className={label}>Entry requirements (one per line)</label>
            <textarea className={input} rows={4} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} />
          </div>
          <div>
            <label className={label}>Career opportunities (one per line)</label>
            <textarea className={input} rows={4} value={form.opportunities} onChange={(e) => set("opportunities", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Modules / syllabus outline (one per line)</label>
            <textarea className={input} rows={5} value={form.modules} onChange={(e) => set("modules", e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">
              For full lesson content, build the curriculum under Curricula — this list is the programme-level outline shown on the website.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={submit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Create programme"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgramsInner() {
  const [programs, setPrograms] = useState<ProgramFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<ProgramFull | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPrograms(await programsApi.manageList());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load programmes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (form: FormState) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const base = {
      title: form.title.trim(),
      category: form.category.trim(),
      certificate: form.certificate.trim() || null,
      duration_weeks: form.duration_weeks ? Number(form.duration_weeks) : null,
      tuition_minor: toMinor(form.tuition_cedis),
      application_fee_minor: toMinor(form.application_fee_cedis) ?? 0,
      description: form.description.trim(),
      long_description: form.long_description.trim(),
      requirements: fromLines(form.requirements),
      opportunities: fromLines(form.opportunities),
      modules: fromLines(form.modules),
      is_active: form.is_active,
      accepting_applications: form.accepting_applications,
    };
    try {
      if (editing) {
        await programsApi.update(editing.slug, base);
        setNotice(`Programme "${base.title}" updated — the website shows it immediately.`);
      } else {
        await programsApi.create({ ...base, slug: form.slug.trim(), code: form.code.trim() });
        setNotice(`Programme "${base.title}" created and published to the website.`);
      }
      setDialog(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the programme");
    } finally {
      setBusy(false);
    }
  };

  const toggleListing = async (p: ProgramFull, is_active: boolean) => {
    setError(null);
    setNotice(null);
    try {
      await programsApi.update(p.slug, { is_active });
      setNotice(`"${p.title}" is ${is_active ? "now live on the website" : "delisted from the website"}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change listing");
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Programmes</h1>
              <p className="mt-1 text-sm text-slate-500">
                The programme catalogue. Everything here (active only) is what prospective students see on the
                website and what you can admit students into.
              </p>
            </div>
            <button
              onClick={() => {
                setEditing(null);
                setDialog(true);
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              New programme
            </button>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">Loading programmes…</p>
          ) : programs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No programmes yet — create the first one and it appears on the website instantly.
            </div>
          ) : (
            <ul className="space-y-3">
              {programs.map((p) => (
                <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {p.is_active ? "Live on website" : "Delisted"}
                        </span>
                        {p.accepting_applications ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            Accepting applications
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            Applications closed
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {p.code} · {p.slug} · {p.category}
                        {p.duration_weeks ? ` · ${p.duration_weeks} weeks` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Tuition {formatMoney(p.tuition_minor ?? 0)} · Application fee {formatMoney(p.application_fee_minor)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setEditing(p);
                          setDialog(true);
                        }}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleListing(p, !p.is_active)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          p.is_active
                            ? "border border-red-200 text-red-600 hover:bg-red-50"
                            : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {p.is_active ? "Delist" : "Publish"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppShell>

      <ProgramFormDialog
        open={dialog}
        editing={editing}
        busy={busy}
        error={error}
        onClose={() => {
          setDialog(false);
          setEditing(null);
        }}
        onSave={save}
      />
    </RouteGuard>
  );
}

export default function AdminProgramsPage() {
  return <ProgramsInner />;
}
