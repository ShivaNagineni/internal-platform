import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { X, AlertCircle, Loader2, ChevronDown, GitBranch, Check, RefreshCw } from "lucide-react";
import type { Release, Repository } from "@/types";
import { cn } from "@/lib/utils";
import { useCreateRelease, useUpdateRelease } from "@/hooks/useReleases";
import { useRepositories, useSyncReposFromGitHub } from "@/hooks/useRepositories";

// ─── Semver validation ────────────────────────────────────────────────────────

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9._-]+)?(?:\+[a-zA-Z0-9._-]+)?$/;

function validateVersion(v: string): string | null {
  if (!v.trim()) return "Version is required.";
  if (!SEMVER_RE.test(v.trim())) return "Must be a valid semver string (e.g. 1.2.3 or 1.2.3-rc.1).";
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release?: Release;
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  version: string;
  release_date: string;
  description: string;
  changelog: string;
  repository_ids: string[];
}

interface FormErrors {
  title?: string;
  version?: string;
  release_date?: string;
  global?: string;
}

function getInitialState(release?: Release): FormState {
  return {
    title: release?.title ?? "",
    version: release?.version ?? "",
    release_date: release?.release_date ? release.release_date.substring(0, 10) : "",
    description: release?.description ?? "",
    changelog: release?.changelog ?? "",
    repository_ids: release?.repository_ids ?? [],
  };
}

// ─── Input sub-component ──────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
        {hint && (
          <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">{hint}</span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow duration-150 shadow-sm";

const INPUT_ERROR = "border-rose-300 dark:border-rose-500/80 focus:ring-rose-400";

// ─── Repository multi-select dropdown ────────────────────────────────────────

function RepoMultiSelect({
  repositories,
  selected,
  onChange,
  disabled,
  onSync,
  isSyncing,
}: {
  repositories: Repository[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
}) {
  const selectedRepos = repositories.filter((r) => selected.includes(r.id));

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm shadow-sm transition-colors duration-150",
            "hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GitBranch className="w-4 h-4 text-slate-400 flex-shrink-0" />
            {selectedRepos.length === 0 ? (
              <span className="text-slate-400 dark:text-slate-500">Select repositories…</span>
            ) : (
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {selectedRepos.map((repo) => (
                  <span
                    key={repo.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/80 rounded-md text-xs font-medium"
                  >
                    {repo.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-[60] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
        >
          {repositories.length === 0 ? (
            <div className="px-4 py-4 flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No repositories yet.</p>
              {onSync && (
                <button
                  type="button"
                  onClick={onSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-950 rounded-lg transition-colors duration-150 disabled:opacity-60"
                >
                  <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                  {isSyncing ? "Fetching from GitHub…" : "Fetch from GitHub"}
                </button>
              )}
            </div>
          ) : (
            <div className="p-1 max-h-52 overflow-y-auto">
              {repositories.map((repo) => {
                const isChecked = selected.includes(repo.id);
                return (
                  <DropdownMenu.Item
                    key={repo.id}
                    onSelect={(e) => {
                      e.preventDefault(); // keep menu open on select
                      toggle(repo.id);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer outline-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-100 group"
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-100",
                        isChecked
                          ? "bg-indigo-600 border-indigo-600"
                          : "border-slate-300 dark:border-slate-600 group-hover:border-indigo-400",
                      )}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{repo.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate font-mono">{repo.github_repo}</p>
                    </div>
                  </DropdownMenu.Item>
                );
              })}
            </div>
          )}

          {selected.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 font-medium transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReleaseForm({ open, onOpenChange, release }: Props) {
  const isEditMode = Boolean(release);
  const createRelease = useCreateRelease();
  const updateRelease = useUpdateRelease();
  const { data: repositories = [] } = useRepositories();
  const syncRepos = useSyncReposFromGitHub();

  const [form, setForm] = useState<FormState>(() => getInitialState(release));
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});

  // Reset form when modal opens/closes or release changes
  useEffect(() => {
    if (open) {
      setForm(getInitialState(release));
      setErrors({});
      setTouched({});
    }
  }, [open, release]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error on change
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function markTouched(key: keyof FormState) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!form.title.trim()) e.title = "Title is required.";
    if (!isEditMode) {
      const vErr = validateVersion(form.version);
      if (vErr) e.version = vErr;
      if (!form.release_date) e.release_date = "Release date is required.";
    }
    return e;
  }

  const isBusy = createRelease.isPending || updateRelease.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ title: true, version: !isEditMode, release_date: !isEditMode });

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      if (isEditMode && release) {
        await updateRelease.mutateAsync({
          id: release.id,
          payload: {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            release_date: form.release_date,
            changelog: form.changelog.trim() || undefined,
            repository_ids: form.repository_ids,
          },
        });
      } else {
        await createRelease.mutateAsync({
          title: form.title.trim(),
          version: form.version.trim(),
          release_date: form.release_date,
          description: form.description.trim() || undefined,
          repository_ids: form.repository_ids,
        });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const axiosDetail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const msg = axiosDetail ?? (err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setErrors({ global: msg });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <Dialog.Title className="text-base font-bold text-slate-900 dark:text-white">
                {isEditMode ? "Edit Release" : "Plan New Release"}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isEditMode
                  ? "Update the details for this release."
                  : "Create a new release entry to track through the pipeline."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="px-6 py-5 space-y-5">

              {/* Global error */}
              {errors.global && (
                <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/60 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 dark:text-rose-300">{errors.global}</p>
                </div>
              )}

              {/* Title */}
              <Field label="Title" required error={touched.title ? errors.title : undefined}>
                <input
                  type="text"
                  placeholder="e.g. Authentication overhaul"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  onBlur={() => markTouched("title")}
                  className={cn(INPUT_BASE, touched.title && errors.title && INPUT_ERROR)}
                  disabled={isBusy}
                />
              </Field>

              {/* Version */}
              <Field
                label="Version"
                required
                hint="e.g. 1.2.3"
                error={touched.version ? errors.version : undefined}
              >
                <input
                  type="text"
                  placeholder="1.2.3"
                  value={form.version}
                  onChange={(e) => setField("version", e.target.value)}
                  onBlur={() => markTouched("version")}
                  disabled={isEditMode || isBusy}
                  className={cn(
                    INPUT_BASE,
                    "font-mono tracking-wide",
                    touched.version && errors.version && INPUT_ERROR,
                    isEditMode && "bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  )}
                />
                {isEditMode && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Version cannot be changed after creation.
                  </p>
                )}
              </Field>

              {/* Release date */}
              <Field
                label="Release Date"
                required
                error={touched.release_date ? errors.release_date : undefined}
              >
                <input
                  type="date"
                  value={form.release_date}
                  min={new Date().toISOString().substring(0, 10)}
                  onChange={(e) => setField("release_date", e.target.value)}
                  onBlur={() => markTouched("release_date")}
                  className={cn(
                    INPUT_BASE,
                    touched.release_date && errors.release_date && INPUT_ERROR
                  )}
                  disabled={isBusy}
                />
              </Field>

              {/* Description */}
              <Field label="Description" hint="optional">
                <textarea
                  placeholder="What does this release include?"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={3}
                  className={cn(INPUT_BASE, "resize-none leading-relaxed")}
                  disabled={isBusy}
                />
              </Field>

              {/* Repositories */}
              <Field label="Repositories" hint="Select one or more repos for this release">
                <RepoMultiSelect
                  repositories={repositories}
                  selected={form.repository_ids}
                  onChange={(ids) => setField("repository_ids", ids)}
                  disabled={isBusy}
                  onSync={() => syncRepos.mutate()}
                  isSyncing={syncRepos.isPending}
                />
              </Field>

              {/* OLD checkbox implementation — kept for reference
              <Field label="Repositories" hint="Select repositories for this release">
                <div className="grid gap-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/50 max-h-48 overflow-y-auto">
                  {repositories.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic px-2">No repositories configured.</p>
                  ) : (
                    repositories.map((repo) => (
                      <label key={repo.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 transition-all"
                          checked={form.repository_ids.includes(repo.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setField("repository_ids", [...form.repository_ids, repo.id]);
                            } else {
                              setField("repository_ids", form.repository_ids.filter((id) => id !== repo.id));
                            }
                          }}
                          disabled={isBusy}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{repo.name}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{repo.github_repo}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </Field>
              */}

              {/* Changelog — edit mode only */}
              {isEditMode && (
                <Field label="Changelog" hint="markdown supported">
                  <textarea
                    placeholder={"## What's Changed\n\n- Fixed authentication bug\n- Improved performance\n- Added new dashboard widgets"}
                    value={form.changelog}
                    onChange={(e) => setField("changelog", e.target.value)}
                    rows={6}
                    className={cn(INPUT_BASE, "resize-none font-mono text-xs leading-relaxed")}
                    disabled={isBusy}
                  />
                </Field>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-150"
                  disabled={isBusy}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isBusy}
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl transition-colors duration-150 shadow-sm",
                  isBusy
                    ? "bg-indigo-400 dark:bg-indigo-600 text-white cursor-not-allowed opacity-70"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                )}
              >
                {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEditMode ? "Save Changes" : "Create Release"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
