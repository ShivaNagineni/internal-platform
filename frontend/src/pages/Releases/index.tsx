import { useState, useMemo } from "react";
import { useMsal, useAccount } from "@azure/msal-react";
import {
  Rocket,
  Plus,
  LayoutGrid,
  GitBranch,
  Zap,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import type { Release, ReleaseStatus, UserRole } from "@/types";
import { cn } from "@/lib/utils";
import { useReleases, useUpdateRelease, useDeployRelease, useApproveRelease } from "@/hooks/useReleases";
import ReleaseCard from "@/components/Releases/ReleaseCard";
import ReleaseDetailModal from "@/components/Releases/ReleaseDetailModal";
import ReleaseForm from "@/components/Releases/ReleaseForm";
import ReleaseTimeline from "@/components/Releases/ReleaseTimeline";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "pipeline" | "timeline";
type StatusFilter = ReleaseStatus | "ALL";

// ─── Pipeline column config ───────────────────────────────────────────────────

interface Column {
  status: ReleaseStatus;
  label: string;
  headerBg: string;
  headerText: string;
  countBg: string;
  emptyText: string;
}

const COLUMNS: Column[] = [
  {
    status: "PLANNED",
    label: "Planned",
    headerBg: "bg-slate-100",
    headerText: "text-slate-700",
    countBg: "bg-slate-200 text-slate-600",
    emptyText: "No planned releases",
  },
  {
    status: "STAGING",
    label: "In QA",
    headerBg: "bg-purple-50",
    headerText: "text-purple-700",
    countBg: "bg-purple-100 text-purple-600",
    emptyText: "Nothing in QA",
  },
  {
    status: "IN_PROGRESS",
    label: "Releasing",
    headerBg: "bg-indigo-50",
    headerText: "text-indigo-700",
    countBg: "bg-indigo-100 text-indigo-600",
    emptyText: "Nothing releasing",
  },
  {
    status: "RELEASED",
    label: "Released",
    headerBg: "bg-emerald-50",
    headerText: "text-emerald-700",
    countBg: "bg-emerald-100 text-emerald-600",
    emptyText: "No releases yet",
  },
  {
    status: "CANCELLED",
    label: "Cancelled",
    headerBg: "bg-rose-50",
    headerText: "text-rose-700",
    countBg: "bg-rose-100 text-rose-600",
    emptyText: "No cancellations",
  },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PLANNED", label: "Planned" },
  { value: "STAGING", label: "In QA" },
  { value: "IN_PROGRESS", label: "Releasing" },
  { value: "RELEASED", label: "Released" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ─── Role detection ───────────────────────────────────────────────────────────

function useCurrentUserRole(): UserRole {
  const { accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);
  const email = account?.username?.toLowerCase() ?? "";
  if (email === "shiva.nagineni@tekyantra.com" || email === "shiva.kumar.nagineni@gmail.com") return "MANAGER";
  const roles = (account?.idTokenClaims as Record<string, unknown> | undefined)
    ?.roles as string[] | undefined;
  const upperRoles = roles?.map((r) => r.toUpperCase()) ?? [];
  if (upperRoles.includes("ADMIN")) return "ADMIN";
  if (upperRoles.includes("MANAGER")) return "MANAGER";
  return "EMPLOYEE";
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-14 bg-slate-100 rounded-md" />
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
      </div>
      <div className="h-4 w-3/4 bg-slate-100 rounded" />
      <div className="h-3 w-full bg-slate-100 rounded" />
      <div className="h-3 w-2/3 bg-slate-100 rounded" />
      <div className="h-2 w-full bg-slate-100 rounded-full mt-4" />
    </div>
  );
}

function SkeletonColumn({ count = 2 }: { count?: number }) {
  return (
    <div className="flex-shrink-0 w-72 space-y-3">
      <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          color
        )}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Pipeline column ──────────────────────────────────────────────────────────

interface PipelineColumnProps {
  column: Column;
  releases: Release[];
  currentUserRole: UserRole;
  onEdit: (release: Release) => void;
  onStatusAdvance: (id: string, status: ReleaseStatus) => void;
  onDeploy: (id: string) => void;
  onApproveRelease: (id: string) => void;
  onClick: (release: Release) => void;
}

function PipelineColumn({
  column,
  releases,
  currentUserRole,
  onEdit,
  onStatusAdvance,
  onDeploy,
  onApproveRelease,
  onClick,
}: PipelineColumnProps) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      {/* Column header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2.5 rounded-xl mb-3",
          column.headerBg
        )}
      >
        <span className={cn("text-sm font-semibold", column.headerText)}>
          {column.label}
        </span>
        <span
          className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            column.countBg
          )}
        >
          {releases.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 flex-1">
        {releases.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
            {column.emptyText}
          </div>
        ) : (
          releases.map((release) => (
            <ReleaseCard
              key={release.id}
              release={release}
              currentUserRole={currentUserRole}
              onEdit={onEdit}
              onStatusAdvance={onStatusAdvance}
              onDeploy={onDeploy}
              onApproveRelease={onApproveRelease}
              onClick={onClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReleasesPage() {
  const currentUserRole = useCurrentUserRole();
  const canManage = currentUserRole === "MANAGER" || currentUserRole === "ADMIN" || currentUserRole === "OWNER";

  // Data
  const { data: releases = [], isLoading } = useReleases();
  const updateRelease = useUpdateRelease();
  const deployRelease = useDeployRelease();
  const approveRelease = useApproveRelease();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [detailRelease, setDetailRelease] = useState<Release | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | undefined>(undefined);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function handleCardClick(release: Release) {
    setDetailRelease(release);
    setDetailOpen(true);
  }

  function handleEdit(release: Release) {
    setEditingRelease(release);
    setFormOpen(true);
  }

  function handleCreateClick() {
    setEditingRelease(undefined);
    setFormOpen(true);
  }

  function handleStatusChange(id: string, status: ReleaseStatus) {
    updateRelease.mutate({ id, payload: { status } });
  }

  function handleDeploy(id: string) {
    deployRelease.mutate(id);
  }

  function handleApproveRelease(id: string) {
    approveRelease.mutate(id);
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const filteredReleases = useMemo<Release[]>(() => {
    if (statusFilter === "ALL") return releases;
    return releases.filter((r) => r.status === statusFilter);
  }, [releases, statusFilter]);

  const releasesByStatus = useMemo<Record<ReleaseStatus, Release[]>>(() => {
    const grouped: Record<ReleaseStatus, Release[]> = {
      PLANNED: [],
      IN_PROGRESS: [],
      STAGING: [],
      RELEASED: [],
      CANCELLED: [],
    };
    filteredReleases.forEach((r) => {
      grouped[r.status].push(r);
    });
    return grouped;
  }, [filteredReleases]);

  // Stats (always from unfiltered list)
  const currentYear = new Date().getFullYear();
  const activeCount = releases.filter(
    (r) => r.status === "IN_PROGRESS" || r.status === "STAGING"
  ).length;
  const upcomingCount = releases.filter((r) => r.status === "PLANNED").length;
  const releasedThisYear = releases.filter(
    (r) =>
      r.status === "RELEASED" &&
      r.release_date != null &&
      new Date(`${r.release_date}T00:00:00`).getFullYear() === currentYear
  ).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Release Control
            <Rocket className="w-5 h-5 text-indigo-500" />
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track software releases through the delivery pipeline.
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors duration-150"
          >
            <Plus className="w-4 h-4" />
            Plan Release
          </button>
        )}
      </div>

      {/* Stats strip */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Zap}
            label="Active releases"
            value={activeCount}
            color="bg-indigo-500"
          />
          <StatCard
            icon={Calendar}
            label="Upcoming (planned)"
            value={upcomingCount}
            color="bg-slate-500"
          />
          <StatCard
            icon={CheckCircle2}
            label={`Released in ${currentYear}`}
            value={releasedThisYear}
            color="bg-emerald-500"
          />
        </div>
      )}

      {/* View toggle + filter bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode("pipeline")}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-150",
              viewMode === "pipeline"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Pipeline
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-150",
              viewMode === "timeline"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Timeline
          </button>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150",
                statusFilter === value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pipeline view ─────────────────────────────────────────────────── */}
      {viewMode === "pipeline" && (
        <div className="overflow-x-auto pb-4">
          {isLoading ? (
            <div className="flex gap-4 min-w-max">
              {COLUMNS.map((col) => (
                <SkeletonColumn key={col.status} count={col.status === "PLANNED" ? 3 : 1} />
              ))}
            </div>
          ) : (
            <div className="flex gap-4 min-w-max">
              {COLUMNS.map((column) => (
                <PipelineColumn
                  key={column.status}
                  column={column}
                  releases={releasesByStatus[column.status]}
                  currentUserRole={currentUserRole}
                  onEdit={handleEdit}
                  onStatusAdvance={handleStatusChange}
                  onDeploy={handleDeploy}
                  onApproveRelease={handleApproveRelease}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Timeline view ─────────────────────────────────────────────────── */}
      {viewMode === "timeline" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-8 px-6 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <ReleaseTimeline
              releases={filteredReleases}
              onReleaseClick={handleCardClick}
            />
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* Detail modal */}
      <ReleaseDetailModal
        release={detailRelease}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailRelease(null);
        }}
        currentUserRole={currentUserRole}
        onStatusChange={handleStatusChange}
        onDeploy={handleDeploy}
        onApproveRelease={handleApproveRelease}
      />

      {/* Create / Edit form modal */}
      <ReleaseForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingRelease(undefined);
        }}
        release={editingRelease}
      />
    </div>
  );
}
