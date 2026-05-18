import { Edit, ChevronRight, User, Trash2, GitBranch } from "lucide-react";
import type { Release, ReleaseStatus, UserRole } from "@/types";
import { cn, formatDate, getInitials } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";

// ─── Pipeline step config ─────────────────────────────────────────────────────

const PIPELINE_STEPS: { status: ReleaseStatus; label: string }[] = [
  { status: "PLANNED", label: "Planned" },
  { status: "STAGING", label: "In QA" },
  { status: "IN_PROGRESS", label: "Releasing" },
  { status: "RELEASED", label: "Released" },
];

const ACCENT_COLORS: Record<ReleaseStatus, string> = {
  PLANNED: "bg-slate-400",
  IN_PROGRESS: "bg-indigo-500",
  STAGING: "bg-purple-500",
  RELEASED: "bg-emerald-500",
  CANCELLED: "bg-rose-400",
};

const STEP_COLORS: Record<ReleaseStatus, string> = {
  PLANNED: "bg-slate-400 border-slate-400",
  IN_PROGRESS: "bg-indigo-500 border-indigo-500",
  STAGING: "bg-purple-500 border-purple-500",
  RELEASED: "bg-emerald-500 border-emerald-500",
  CANCELLED: "bg-rose-400 border-rose-400",
};

// ─── Next status transition map ───────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPipelineStepIndex(status: ReleaseStatus): number {
  return PIPELINE_STEPS.findIndex((s) => s.status === status);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  release: Release;
  currentUserRole: UserRole;
  onEdit?: (release: Release) => void;
  onStatusAdvance?: (id: string, status: ReleaseStatus) => void;
  onDeploy?: (id: string) => void;
  onApproveRelease?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick: (release: Release) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReleaseCard({
  release,
  currentUserRole,
  onEdit,
  onStatusAdvance,
  onDeploy,
  onApproveRelease,
  onDelete,
  onClick,
}: Props) {
  const canManage = currentUserRole === "MANAGER" || currentUserRole === "ADMIN" || currentUserRole === "OWNER";
  const isCancelled = release.status === "CANCELLED";
  const currentIndex = getPipelineStepIndex(release.status);
  const nextStatus = NEXT_STATUS[release.status];
  const nextLabel = NEXT_LABEL[release.status];
  const accentColor = ACCENT_COLORS[release.status];

  function handleAdvance(e: React.MouseEvent) {
    e.stopPropagation();
    if (release.status === "PLANNED") {
      if (onDeploy) onDeploy(release.id);
    } else if (release.status === "STAGING" || release.status === "IN_PROGRESS") {
      if (onApproveRelease) onApproveRelease(release.id);
    } else if (nextStatus && onStatusAdvance) {
      onStatusAdvance(release.id, nextStatus);
    }
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    if (onEdit) onEdit(release);
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    if (onStatusAdvance) {
      onStatusAdvance(release.id, "CANCELLED");
    }
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (onDelete && window.confirm(`Delete release v${release.version}? This cannot be undone.`)) {
      onDelete(release.id);
    }
  }

  return (
    <div
      onClick={() => onClick(release)}
      className={cn(
        "relative bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden",
        "transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:-translate-y-0.5",
        isCancelled && "opacity-60"
      )}
    >
      {/* Left accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", accentColor)} />

      {/* Card content */}
      <div className="pl-5 pr-4 pt-4 pb-3 space-y-3">

        {/* Top row: version + status + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md tracking-tight">
              v{release.version}
            </span>
            <StatusBadge status={release.status} size="sm" />
          </div>
          {canManage && (
            <button
              onClick={handleEdit}
              className="flex-shrink-0 p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 rounded-lg transition-colors duration-150"
              title="Edit release"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-1">
          {release.title}
        </h3>

        {/* Description */}
        {release.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
            {release.description}
          </p>
        )}

        {/* Repo chips */}
        {release.repositories && release.repositories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <GitBranch className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
            {release.repositories.slice(0, 2).map((repo) => (
              <span
                key={repo.id}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]"
                title={repo.name}
              >
                {repo.name}
              </span>
            ))}
            {release.repositories.length > 2 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                +{release.repositories.length - 2} more
              </span>
            )}
          </div>
        )}

        {/* Owner + date row */}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {release.owner && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[9px] font-semibold leading-none">
                  {getInitials(release.owner.display_name)}
                </span>
              </div>
              <span className="truncate max-w-[100px]">{release.owner.display_name}</span>
            </div>
          )}
          {release.owner && release.release_date && <span className="text-slate-300 dark:text-slate-600">·</span>}
          {release.release_date && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>{formatDate(release.release_date)}</span>
            </div>
          )}
        </div>

        {/* Pipeline stepper (only for non-cancelled) */}
        {!isCancelled && (
          <div className="pt-1">
            <div className="flex items-center gap-0">
              {PIPELINE_STEPS.map((step, idx) => {
                const isCompleted = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                const isLast = idx === PIPELINE_STEPS.length - 1;

                return (
                  <div key={step.status} className="flex items-center flex-1 min-w-0">
                    {/* Dot */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className={cn(
                          "w-2.5 h-2.5 rounded-full border-2 transition-all duration-200",
                          isCompleted
                            ? STEP_COLORS[step.status] + " scale-90"
                            : isCurrent
                            ? STEP_COLORS[step.status] + " ring-2 ring-offset-1 ring-current scale-110"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        )}
                        style={
                          isCurrent
                            ? { ringColor: "inherit" }
                            : undefined
                        }
                      />
                    </div>
                    {/* Connector line */}
                    {!isLast && (
                      <div
                        className={cn(
                          "flex-1 h-px mx-0.5 transition-colors duration-200",
                          idx < currentIndex ? "bg-slate-300 dark:bg-slate-600" : "bg-slate-200 dark:bg-slate-700"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center mt-1 gap-0">
              {PIPELINE_STEPS.map((step, idx) => {
                const isLast = idx === PIPELINE_STEPS.length - 1;
                return (
                  <div key={step.status} className="flex items-center flex-1 min-w-0">
                    <span
                      className={cn(
                        "text-[9px] leading-tight flex-shrink-0",
                        idx === currentIndex
                          ? "text-slate-700 dark:text-slate-200 font-semibold"
                          : "text-slate-400 dark:text-slate-500"
                      )}
                    >
                      {step.label}
                    </span>
                    {!isLast && <div className="flex-1" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons row */}
        {canManage && !isCancelled && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            {nextStatus && nextLabel && (
              <button
                onClick={handleAdvance}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors duration-150",
                  release.status === "PLANNED"
                    ? "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                    : release.status === "IN_PROGRESS"
                    ? "bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900"
                    : "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                )}
              >
                <ChevronRight className="w-3 h-3" />
                {nextLabel}
              </button>
            )}
            {release.status !== "RELEASED" && (
              <button
                onClick={handleCancel}
                className="ml-auto text-xs text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/80 px-2 py-1.5 rounded-lg transition-colors duration-150"
              >
                Cancel
              </button>
            )}
            {release.status === "PLANNED" && onDelete && (
              <button
                onClick={handleDelete}
                className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/80 rounded-lg transition-colors duration-150"
                title="Delete release"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
