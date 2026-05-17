import { Rocket, CheckCircle2, Sparkles, Layers, Calendar, XCircle, Clock, User } from "lucide-react";
import type { Release, ReleaseStatus } from "@/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";

// ─── Status configuration ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ReleaseStatus,
  { bg: string; border: string; glow: string; dot: string; icon: any; iconColor: string; spineGlow: string }
> = {
  PLANNED: {
    bg: "bg-white hover:bg-slate-50/80",
    border: "border-slate-200 hover:border-slate-300",
    glow: "shadow-sm hover:shadow-md",
    dot: "bg-slate-400 border-white",
    icon: Calendar,
    iconColor: "text-slate-500",
    spineGlow: "",
  },
  IN_PROGRESS: {
    bg: "bg-gradient-to-br from-indigo-50/60 via-white to-white hover:from-indigo-50",
    border: "border-indigo-200 hover:border-indigo-400 ring-1 ring-indigo-400/20",
    glow: "shadow-md hover:shadow-indigo-100 shadow-indigo-500/10",
    dot: "bg-indigo-600 border-white",
    icon: Sparkles,
    iconColor: "text-indigo-600 animate-pulse",
    spineGlow: "ring-8 ring-indigo-500/20",
  },
  STAGING: {
    bg: "bg-gradient-to-br from-purple-50/60 via-white to-white hover:from-purple-50",
    border: "border-purple-200 hover:border-purple-400 ring-1 ring-purple-400/20",
    glow: "shadow-md hover:shadow-purple-100 shadow-purple-500/10",
    dot: "bg-purple-600 border-white",
    icon: Layers,
    iconColor: "text-purple-600",
    spineGlow: "ring-8 ring-purple-500/20",
  },
  RELEASED: {
    bg: "bg-white hover:bg-emerald-50/30",
    border: "border-slate-200 hover:border-emerald-300",
    glow: "shadow-sm hover:shadow-md hover:shadow-emerald-500/5",
    dot: "bg-emerald-500 border-white",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    spineGlow: "",
  },
  CANCELLED: {
    bg: "bg-rose-50/30 hover:bg-rose-50/50",
    border: "border-rose-100 hover:border-rose-200",
    glow: "shadow-sm hover:shadow-md",
    dot: "bg-rose-400 border-white",
    icon: XCircle,
    iconColor: "text-rose-500",
    spineGlow: "",
  },
};

const STEP_COLORS: Record<ReleaseStatus, string> = {
  PLANNED: "bg-slate-400",
  IN_PROGRESS: "bg-indigo-500",
  STAGING: "bg-purple-500",
  RELEASED: "bg-emerald-500",
  CANCELLED: "bg-rose-500",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  releases: Release[];
  onReleaseClick: (release: Release) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isReleasePast(release: Release): boolean {
  return release.status === "RELEASED" || release.status === "CANCELLED";
}

function isReleaseCurrent(release: Release): boolean {
  return release.status === "IN_PROGRESS" || release.status === "STAGING";
}

// ─── Timeline node card ───────────────────────────────────────────────────────

interface TimelineNodeProps {
  release: Release;
  isLeft: boolean;
  isLast: boolean;
  onClick: (release: Release) => void;
}

function TimelineNode({ release, isLeft, isLast, onClick }: TimelineNodeProps) {
  const past = isReleasePast(release);
  const current = isReleaseCurrent(release);
  const cfg = STATUS_CONFIG[release.status] || STATUS_CONFIG.PLANNED;
  const StatusIcon = cfg.icon;

  const card = (
    <button
      onClick={() => onClick(release)}
      className={cn(
        "group text-left w-full max-w-md rounded-2xl border p-5 transition-all duration-300 backdrop-blur-sm relative overflow-hidden",
        "hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
        cfg.bg,
        cfg.border,
        cfg.glow,
        past && !current && "opacity-75 hover:opacity-100"
      )}
    >
      {/* Subtle top background glow for active items */}
      {current && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
      )}

      {/* Top row: version badge + status badge */}
      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-xs font-extrabold px-3 py-1 rounded-lg tracking-tight shadow-sm flex items-center gap-1.5",
              current
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                : past
                ? "bg-slate-100 text-slate-600 border border-slate-200"
                : "bg-slate-100 text-slate-700 border border-slate-200"
            )}
          >
            <StatusIcon className={cn("w-3.5 h-3.5", current ? "text-white" : cfg.iconColor)} />
            <span>v{release.version}</span>
          </span>
        </div>
        <StatusBadge status={release.status} size="sm" />
      </div>

      {/* Title */}
      <h3
        className={cn(
          "text-base font-bold leading-snug line-clamp-2 mb-2 transition-colors relative z-10",
          current ? "text-indigo-950 group-hover:text-indigo-600" : past ? "text-slate-800" : "text-slate-900 group-hover:text-indigo-600"
        )}
      >
        {release.title}
      </h3>

      {/* Description */}
      {release.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-4 relative z-10">
          {release.description}
        </p>
      )}

      {/* Status History Micro-Timeline */}
      {release.status_history && release.status_history.length > 0 && (
        <div className="mb-4 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100/80 relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Status Transition History</span>
          </p>
          <div className="space-y-2 font-mono text-xs">
            {release.status_history.map((hist, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0 shadow-xs", STEP_COLORS[hist.status])} />
                  <span className="font-semibold text-slate-700 text-[11px]">{hist.status.replace("_", " ")}</span>
                </div>
                <span className="text-slate-400 text-[10px]">{formatDateTime(hist.changed_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-slate-100/80 my-3" />

      {/* Bottom row: owner + date */}
      <div className="flex items-center justify-between text-xs text-slate-400 relative z-10">
        {release.owner && (
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-[140px]">{release.owner.display_name}</span>
          </div>
        )}
        {release.release_date && (
          <div className="flex items-center gap-1.5 ml-auto font-medium text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(release.release_date)}</span>
          </div>
        )}
      </div>
    </button>
  );

  return (
    <div className={cn("relative flex items-center", !isLast && "mb-12")}>
      {/* Left card or spacer */}
      <div className="flex-1 flex justify-end pr-8">
        {isLeft ? card : <div />}
      </div>

      {/* Center dot + vertical line */}
      <div className="flex flex-col items-center flex-shrink-0 relative">
        {/* Pulse effect behind active dot */}
        {current && (
          <div className="absolute w-10 h-10 rounded-full bg-indigo-500/20 animate-ping -z-10" />
        )}
        {/* Dot */}
        <div
          className={cn(
            "w-6 h-6 rounded-full border-4 z-10 transition-all duration-300 shadow-md flex items-center justify-center",
            cfg.dot,
            cfg.spineGlow
          )}
        >
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>

        {/* Vertical connector line */}
        {!isLast && (
          <div
            className={cn(
              "absolute top-6 w-1 h-[calc(100%+3rem)] rounded-full transition-all duration-300",
              current ? "bg-gradient-to-b from-indigo-500 via-purple-300 to-slate-200" : "bg-slate-200"
            )}
          />
        )}
      </div>

      {/* Right card or spacer */}
      <div className="flex-1 flex justify-start pl-8">
        {!isLeft ? card : <div />}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReleaseTimeline({ releases, onReleaseClick }: Props) {
  if (releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
          <Rocket className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-base font-semibold text-slate-700">No releases scheduled</p>
        <p className="text-sm text-slate-400 mt-1">
          Plan your first release to see the timeline.
        </p>
      </div>
    );
  }

  // Sort by release_date ascending.
  const sorted = [...releases].sort((a, b) =>
    (a.release_date ?? "").localeCompare(b.release_date ?? "")
  );

  return (
    <div className="relative py-8 px-4 max-w-5xl mx-auto">
      {/* Vertical spine line */}
      <div className="absolute left-1/2 top-4 bottom-4 w-1 bg-slate-100 rounded-full -translate-x-1/2 pointer-events-none shadow-inner" />

      <div className="relative">
        {sorted.map((release, idx) => (
          <TimelineNode
            key={release.id}
            release={release}
            isLeft={idx % 2 === 0}
            isLast={idx === sorted.length - 1}
            onClick={onReleaseClick}
          />
        ))}
      </div>
    </div>
  );
}
