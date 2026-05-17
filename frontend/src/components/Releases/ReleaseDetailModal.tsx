import * as Dialog from "@radix-ui/react-dialog";
import { X, Calendar, User, Clock, ChevronRight, Ban } from "lucide-react";
import type { Release, ReleaseStatus, UserRole } from "@/types";
import { cn, formatDate, formatDateTime, getInitials } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";

// ─── Pipeline step config ─────────────────────────────────────────────────────

const PIPELINE_STEPS: { status: ReleaseStatus; label: string }[] = [
  { status: "PLANNED", label: "Planned" },
  { status: "STAGING", label: "In QA" },
  { status: "IN_PROGRESS", label: "Releasing" },
  { status: "RELEASED", label: "Released" },
];

const STEP_DOT_COLORS: Record<ReleaseStatus, string> = {
  PLANNED: "bg-slate-400 border-slate-400",
  IN_PROGRESS: "bg-indigo-500 border-indigo-500",
  STAGING: "bg-purple-500 border-purple-500",
  RELEASED: "bg-emerald-500 border-emerald-500",
  CANCELLED: "bg-rose-400 border-rose-400",
};

const NEXT_STATUS: Partial<Record<ReleaseStatus, ReleaseStatus>> = {
  PLANNED: "IN_PROGRESS",
  IN_PROGRESS: "STAGING",
  STAGING: "RELEASED",
};

const NEXT_LABEL: Partial<Record<ReleaseStatus, string>> = {
  PLANNED: "Approve Deployment",
  STAGING: "Approve Release",
  IN_PROGRESS: "Approve Release",
};

const ADVANCE_BUTTON_COLORS: Partial<Record<ReleaseStatus, string>> = {
  PLANNED: "bg-indigo-600 hover:bg-indigo-700 text-white",
  IN_PROGRESS: "bg-purple-600 hover:bg-purple-700 text-white",
  STAGING: "bg-emerald-600 hover:bg-emerald-700 text-white",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  release: Release | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserRole: UserRole;
  onStatusChange: (id: string, status: ReleaseStatus) => void;
  onDeploy: (id: string) => void;
  onApproveRelease: (id: string) => void;
}

// ─── Stepper sub-component ────────────────────────────────────────────────────

function PipelineStepper({
  currentStatus,
}: {
  currentStatus: ReleaseStatus;
}) {
  const isCancelled = currentStatus === "CANCELLED";
  const currentIndex = isCancelled
    ? -1
    : PIPELINE_STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className="relative">
      {isCancelled ? (
        <div className="flex items-center gap-2 py-3 px-4 bg-rose-50 rounded-xl border border-rose-100">
          <Ban className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <p className="text-sm text-rose-600 font-medium">
            This release has been cancelled.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-0">
          {PIPELINE_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isLast = idx === PIPELINE_STEPS.length - 1;

            return (
              <div key={step.status} className="flex items-start flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  {/* Dot */}
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all duration-200",
                      isCompleted
                        ? STEP_DOT_COLORS[step.status]
                        : isCurrent
                        ? STEP_DOT_COLORS[step.status] + " ring-4 ring-offset-0"
                        : "bg-white border-slate-200"
                    )}
                    style={
                      isCurrent
                        ? {
                            boxShadow: "0 0 0 3px rgba(99,102,241,0.15)",
                          }
                        : undefined
                    }
                  />
                  {/* Label */}
                  <span
                    className={cn(
                      "text-[10px] mt-1.5 text-center leading-tight whitespace-nowrap",
                      isCurrent
                        ? "text-slate-800 font-semibold"
                        : isCompleted
                        ? "text-slate-500 font-medium"
                        : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "flex-1 h-px mt-2 mx-1 transition-colors duration-200",
                      idx < currentIndex ? "bg-slate-300" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReleaseDetailModal({
  release,
  open,
  onOpenChange,
  currentUserRole,
  onStatusChange,
  onDeploy,
  onApproveRelease,
}: Props) {
  if (!release) return null;

  const canManage = currentUserRole === "MANAGER" || currentUserRole === "ADMIN" || currentUserRole === "OWNER";
  const isCancelled = release.status === "CANCELLED";
  const isTerminal = release.status === "RELEASED" || isCancelled;
  const nextStatus = NEXT_STATUS[release.status];
  const nextLabel = NEXT_LABEL[release.status];
  const advanceButtonColor = ADVANCE_BUTTON_COLORS[release.status];

  function handleAdvance() {
    if (release.status === "PLANNED") {
      onDeploy(release.id);
      onOpenChange(false);
    } else if (release.status === "STAGING" || release.status === "IN_PROGRESS") {
      onApproveRelease(release.id);
      onOpenChange(false);
    } else if (nextStatus) {
      onStatusChange(release.id, nextStatus);
      onOpenChange(false);
    }
  }

  function handleCancel() {
    onStatusChange(release.id, "CANCELLED");
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="font-mono text-sm font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg tracking-tight flex-shrink-0 mt-0.5">
                  v{release.version}
                </span>
                <div className="min-w-0">
                  <Dialog.Title className="text-lg font-bold text-slate-900 leading-tight truncate">
                    {release.title}
                  </Dialog.Title>
                  <div className="mt-1">
                    <StatusBadge status={release.status} />
                  </div>
                </div>
              </div>
              <Dialog.Close asChild>
                <button className="flex-shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-6">

            {/* Pipeline stepper */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Release Pipeline
              </p>
              <PipelineStepper currentStatus={release.status} />
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Calendar className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Release Date
                  </p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">
                    {release.release_date ? formatDate(release.release_date) : "TBD"}
                  </p>
                </div>
              </div>
              {release.owner && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white text-xs font-semibold leading-none">
                      {getInitials(release.owner.display_name)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Owner
                    </p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">
                      {release.owner.display_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {release.owner.email}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {release.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  Description
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {release.description}
                </p>
              </div>
            )}

            {/* Changelog */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                Changelog
              </p>
              {release.changelog ? (
                <pre className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-48">
                  {release.changelog}
                </pre>
              ) : (
                <div className="flex items-center gap-2 py-4 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-sm italic">
                    No changelog yet
                  </span>
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Created {formatDateTime(release.created_at)}</span>
              </div>
              <span>·</span>
              <span>Updated {formatDateTime(release.updated_at)}</span>
            </div>
          </div>

          {/* Footer actions */}
          {canManage && !isTerminal && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-3">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors duration-150"
              >
                <Ban className="w-4 h-4" />
                Cancel Release
              </button>
              {nextStatus && nextLabel && advanceButtonColor && (
                <button
                  onClick={handleAdvance}
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150 shadow-sm",
                    advanceButtonColor
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                  {nextLabel}
                </button>
              )}
            </div>
          )}

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
