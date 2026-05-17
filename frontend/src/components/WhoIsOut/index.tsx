import { cn, getInitials } from "@/lib/utils";
import type { WhoIsOutEntry } from "@/types";
import { format, parseISO } from "date-fns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Annual Leave",
  SICK: "Sick Leave",
  UNPAID: "Unpaid Leave",
  PARENTAL: "Parental Leave",
  BEREAVEMENT: "Bereavement",
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  ANNUAL: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800",
  SICK: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800",
  UNPAID: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  PARENTAL: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/80 dark:text-violet-300 dark:border-violet-800",
  BEREAVEMENT: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800",
};

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-pink-500",
  "bg-teal-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDateRange(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (start === end) return format(s, "MMM d");
  if (sameMonth) return `${format(s, "MMM d")} – ${format(e, "d")}`;
  return `${format(s, "MMM d")} – ${format(e, "MMM d")}`;
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-1 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full w-36" />
        <div className="h-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-full w-24" />
      </div>
      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
      <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/50 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry row
// ---------------------------------------------------------------------------
function EntryRow({ entry }: { entry: WhoIsOutEntry }) {
  const name = entry.user.display_name;
  const initials = getInitials(name);
  const avatarBg = getAvatarColor(name);
  const leaveLabel = LEAVE_TYPE_LABELS[entry.leave_type] ?? entry.leave_type;
  const badgeClass =
    LEAVE_TYPE_COLORS[entry.leave_type] ?? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  const dateRange = formatDateRange(entry.start_date, entry.end_date);
  const dayText = entry.days === 1 ? "1 day" : `${entry.days} days`;

  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-slate-50 dark:border-slate-800/60 last:border-0 group hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-1 px-2 rounded-lg transition-colors duration-100">
      {/* Avatar */}
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold shadow-sm",
          avatarBg
        )}
      >
        {initials}
      </div>

      {/* Name + department */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate leading-tight">{name}</p>
        {entry.user.department && (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
            {entry.user.department}
          </p>
        )}
      </div>

      {/* Leave type badge */}
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap flex-shrink-0",
          badgeClass
        )}
      >
        {leaveLabel}
      </span>

      {/* Date range + days */}
      <div className="text-right flex-shrink-0 hidden sm:block">
        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">{dateRange}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{dayText}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <span className="text-4xl mb-3 select-none">🏖️</span>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Everyone is in today!</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No approved leaves for today.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface WhoIsOutProps {
  entries: WhoIsOutEntry[];
  loading?: boolean;
}

export default function WhoIsOut({ entries, loading = false }: WhoIsOutProps) {
  if (loading) {
    return (
      <div className="divide-y divide-slate-50">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      {entries.map((entry) => (
        <EntryRow key={entry.user.id} entry={entry} />
      ))}
    </div>
  );
}
