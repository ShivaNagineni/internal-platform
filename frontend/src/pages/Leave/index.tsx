import { useState, useMemo, Component } from "react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";
import { useMsal, useAccount } from "@azure/msal-react";
import FilterSelect from "@/components/FilterSelect";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Plus,
  CalendarOff,
  RefreshCw,
  CalendarDays,
  Stethoscope,
  DollarSign,
  Baby,
  Heart,
  Users,
  Clock,
  CheckCircle2,
  CalendarCheck2,
  Laptop,
  LayoutList,
  CalendarRange,
  ChevronLeft,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import {
  format,
  parseISO,
  isThisMonth,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  addMonths,
  subMonths,
  isWeekend,
} from "date-fns";
import { cn } from "@/lib/utils";
import { useLeaves, useUpdateLeave, useDeleteLeave, useWhoIsOut } from "@/hooks/useLeave";
import LeaveCard from "@/components/Leave/LeaveCard";
import LeaveRequestForm from "@/components/Leave/LeaveRequestForm";
import ApprovalModal from "@/components/Leave/ApprovalModal";
import type { Leave, LeaveStatus, UserRole, LeaveType } from "@/types";

// ─── Error Boundary ──────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class LeaveErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[LeaveErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center">
            <CalendarOff className="w-8 h-8 text-rose-500 dark:text-rose-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Something went wrong</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{this.state.message}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 rounded-lg transition-colors duration-150"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Leave Type Icon map ──────────────────────────────────────────────────────

const LEAVE_TYPE_ICONS: Record<LeaveType, ComponentType<{ className?: string }>> = {
  ANNUAL: CalendarDays,
  SICK: Stethoscope,
  UNPAID: DollarSign,
  PARENTAL: Baby,
  BEREAVEMENT: Heart,
  WFH: Laptop,
};

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: "Annual",
  SICK: "Sick",
  UNPAID: "Unpaid",
  PARENTAL: "Parental",
  BEREAVEMENT: "Bereavement",
  WFH: "WFH",
};

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-pulse">
      <div className="h-1 bg-slate-200 dark:bg-slate-800 w-full" />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/5" />
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800/50 rounded w-2/5" />
          </div>
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/5" />
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800/50 rounded w-3/5" />
          </div>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg px-3 py-2.5 space-y-1.5">
          <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-full" />
          <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
        </div>
      </div>
    </div>
  );
}

// ─── Who Is Out Panel ─────────────────────────────────────────────────────────

function WhoIsOutPanel() {
  const { data, isLoading, isError } = useWhoIsOut();

  return (
    <aside className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center flex-shrink-0">
          <Users className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Who's Out Today</h2>
      </div>

      <div className="p-3 space-y-2">
        {isLoading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-2 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-3/5" />
                  <div className="h-2 bg-slate-100 dark:bg-slate-800/50 rounded w-2/5" />
                </div>
              </div>
            ))}
          </>
        )}

        {isError && (
          <p className="text-xs text-slate-500 dark:text-slate-400 px-2 py-3 text-center">
            Unable to load. Try refreshing.
          </p>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div className="text-center py-6 px-3">
            <div className="text-2xl mb-1">🏢</div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Everyone's in!</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">No one is out today.</p>
          </div>
        )}

        {!isLoading &&
          !isError &&
          data &&
          data.length > 0 &&
          data.map((entry) => {
            const TypeIcon = LEAVE_TYPE_ICONS[entry.leave_type] ?? CalendarDays;
            const initials = entry.user.display_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={`${entry.user.id}-${entry.leave_type}-${entry.start_date}`}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-white text-[9px] font-bold leading-none">{initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate leading-tight">
                    {entry.user.display_name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TypeIcon className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {LEAVE_TYPE_LABELS[entry.leave_type]}
                    </p>
                    <span className="text-slate-300 dark:text-slate-600 flex-shrink-0">·</span>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      until {format(parseISO(entry.end_date), "MMM d")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}

// ─── Filter ───────────────────────────────────────────────────────────────────

type FilterTab = "ALL" | LeaveStatus;

const FILTER_OPTIONS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ─── Stats Strip ─────────────────────────────────────────────────────────────

interface StatsStripProps {
  leaves: Leave[];
  currentUserId: string;
  currentUserEmail: string;
}

function StatsStrip({ leaves, currentUserId, currentUserEmail }: StatsStripProps) {
  const pending = leaves.filter((l) => l.status === "PENDING").length;
  const approvedThisMonth = leaves.filter(
    (l) => l.status === "APPROVED" && isThisMonth(parseISO(l.start_date)),
  ).length;

  const currentYear = new Date().getFullYear();
  const myApprovedLeaves = leaves.filter((l) => {
    const isMine =
      l.user_id === currentUserId ||
      (Boolean(currentUserEmail) && l.user.email.toLowerCase() === currentUserEmail.toLowerCase());
    const isAppr = l.status === "APPROVED";
    const isThisYr = parseISO(l.start_date).getFullYear() === currentYear;
    return isMine && isAppr && isThisYr;
  });

  const usedDays = myApprovedLeaves.reduce((sum, l) => sum + (l.days || 0), 0);
  const totalQuota = 12; // standard 24 days annual quota
  const daysRemaining = Math.max(0, totalQuota - usedDays);

  const stats = [
    {
      label: "Pending Review",
      value: pending,
      icon: Clock,
      iconBg: "bg-amber-100 dark:bg-amber-950/80",
      iconColor: "text-amber-600 dark:text-amber-400",
      valueColor: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "Approved This Month",
      value: approvedThisMonth,
      icon: CheckCircle2,
      iconBg: "bg-emerald-100 dark:bg-emerald-950/80",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      valueColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Days Remaining",
      value: daysRemaining,
      icon: CalendarCheck2,
      iconBg: "bg-indigo-100 dark:bg-indigo-950/80",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      valueColor: "text-indigo-700 dark:text-indigo-300",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value, icon: Icon, iconBg, iconColor, valueColor }) => (
        <div
          key={label}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3.5 flex items-center gap-3"
        >
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", iconBg)}>
            <Icon className={cn("w-[18px] h-[18px]", iconColor)} />
          </div>
          <div className="min-w-0">
            <p className={cn("text-xl font-bold leading-none", valueColor)}>{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-tight">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Leave Calendar ───────────────────────────────────────────────────────────

const STATUS_CHIP_COLORS: Record<string, string> = {
  PENDING: "bg-amber-400 dark:bg-amber-500 text-white",
  APPROVED: "bg-emerald-400 dark:bg-emerald-500 text-white",
  REJECTED: "bg-rose-400 dark:bg-rose-500 text-white",
  CANCELLED: "bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200",
};

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface LeaveCalendarProps {
  leaves: Leave[];
}

function LeaveCalendar({ leaves }: LeaveCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  function getLeavesForDay(day: Date): Leave[] {
    return leaves.filter((leave) => {
      const start = parseISO(leave.start_date + "T00:00:00");
      const end = parseISO(leave.end_date + "T00:00:00");
      return day >= start && day <= end;
    });
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors duration-150"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <button
          onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors duration-150"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="min-h-[88px] bg-slate-50/40 dark:bg-slate-800/10" />
        ))}

        {days.map((day) => {
          const dayLeaves = getLeavesForDay(day);
          const isToday = isSameDay(day, today);
          const isWknd = isWeekend(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[88px] p-1.5 space-y-1 text-left",
                isWknd ? "bg-slate-50/60 dark:bg-slate-800/20" : "bg-white dark:bg-slate-900",
              )}
            >
              <span
                className={cn(
                  "inline-flex w-6 h-6 items-center justify-center rounded-full text-[11px] font-semibold leading-none",
                  isToday
                    ? "bg-indigo-600 text-white"
                    : isWknd
                    ? "text-slate-400 dark:text-slate-500"
                    : "text-slate-600 dark:text-slate-300",
                )}
              >
                {format(day, "d")}
              </span>

              <div className="space-y-0.5">
                {dayLeaves.slice(0, 3).map((leave) => (
                  <div
                    key={leave.id}
                    title={`${leave.user.display_name} — ${leave.leave_type} (${leave.status})`}
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-[2px] rounded truncate leading-tight cursor-default",
                      STATUS_CHIP_COLORS[leave.status] ?? "bg-slate-200 text-slate-700",
                    )}
                  >
                    {leave.user.display_name.split(" ")[0]}
                  </div>
                ))}
                {dayLeaves.length > 3 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1 font-medium">
                    +{dayLeaves.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 flex-wrap bg-slate-50/60 dark:bg-slate-800/20">
        {(["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-sm", STATUS_CHIP_COLORS[status])} />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{status.toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  filter: FilterTab;
  onRequestLeave: () => void;
}

const EMPTY_STATES: Record<FilterTab, { emoji: string; title: string; body: string }> = {
  ALL: {
    emoji: "📅",
    title: "No leave requests yet",
    body: "You haven't made any leave requests. Click 'Request Leave' to get started.",
  },
  PENDING: {
    emoji: "🕐",
    title: "No pending requests",
    body: "There are no leave requests awaiting review right now.",
  },
  APPROVED: {
    emoji: "✅",
    title: "No approved leaves",
    body: "No leave requests have been approved yet.",
  },
  REJECTED: {
    emoji: "❌",
    title: "No rejected leaves",
    body: "No leave requests have been rejected.",
  },
  CANCELLED: {
    emoji: "🚫",
    title: "No cancelled leaves",
    body: "No leave requests have been cancelled.",
  },
};

function EmptyState({ filter, onRequestLeave }: EmptyStateProps) {
  const config = EMPTY_STATES[filter];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center col-span-full">
      <span className="text-5xl mb-4">{config.emoji}</span>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{config.title}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{config.body}</p>
      {filter === "ALL" && (
        <button
          onClick={onRequestLeave}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors duration-150 shadow-sm shadow-indigo-200 dark:shadow-none"
        >
          <Plus className="w-4 h-4" />
          Request Leave
        </button>
      )}
    </div>
  );
}

function useCurrentUserRole(): UserRole {
  const { accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);
  const email = account?.username?.toLowerCase() ?? "";
  if (email === "shiva.nagineni@tekyantra.com" || email === "shiva.kumar.nagineni@gmail.com") return "OWNER";
  const roles = (account?.idTokenClaims as Record<string, unknown> | undefined)
    ?.roles as string[] | undefined;
  const upperRoles = roles?.map((r) => r.toUpperCase()) ?? [];
  if (upperRoles.includes("OWNER")) return "OWNER";
  if (upperRoles.includes("ADMIN")) return "ADMIN";
  if (upperRoles.includes("MANAGER")) return "MANAGER";
  return "EMPLOYEE";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeavePage() {
  const { accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);

  const currentUserId: string = account?.localAccountId ?? "";
  const currentUserEmail: string = account?.username?.toLowerCase() ?? "";
  const currentUserRole: UserRole = useCurrentUserRole();

  const { data: leaves, isLoading, isError, refetch } = useLeaves();
  const { mutate: updateLeave } = useUpdateLeave();
  const { mutate: deleteLeave } = useDeleteLeave();

  const [requestOpen, setRequestOpen] = useState(false);
  const [editLeaveData, setEditLeaveData] = useState<Leave | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [approvalModal, setApprovalModal] = useState<{
    open: boolean;
    action: "approve" | "reject";
    leaveId: string;
  }>({ open: false, action: "approve", leaveId: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const allLeaves: Leave[] = leaves ?? [];

  const filteredLeaves = useMemo(() => {
    if (activeFilter === "ALL") return allLeaves;
    return allLeaves.filter((l) => l.status === activeFilter);
  }, [allLeaves, activeFilter]);

  // Counts for tab badges
  const tabCounts = useMemo(() => {
    const counts: Partial<Record<FilterTab, number>> = { ALL: allLeaves.length };
    (["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as LeaveStatus[]).forEach((s) => {
      counts[s] = allLeaves.filter((l) => l.status === s).length;
    });
    return counts;
  }, [allLeaves]);

  function handleApprove(id: string) {
    setApprovalModal({ open: true, action: "approve", leaveId: id });
  }

  function handleReject(id: string) {
    setApprovalModal({ open: true, action: "reject", leaveId: id });
  }

  function handleCancel(id: string) {
    updateLeave(
      { id, payload: { status: "CANCELLED" } },
      { onError: (err) => console.error("Cancel failed", err) },
    );
  }

  function handleEdit(leave: Leave) {
    setEditLeaveData(leave);
  }

  function handleDelete(id: string) {
    setDeleteConfirm({ open: true, id });
  }

  function handleApprovalSuccess() {
    // query invalidation is handled inside useUpdateLeave
  }

  return (
    <LeaveErrorBoundary>
      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Leave Tracker</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage and review leave requests across your team.
            </p>
          </div>
          <button
            onClick={() => setRequestOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all duration-150 shadow-sm shadow-indigo-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
          >
            <Plus className="w-4 h-4" />
            Request Leave
          </button>
        </div>

        {/* ── Stats Strip ── */}
        {!isLoading && !isError && (
          <StatsStrip
            leaves={allLeaves}
            currentUserId={currentUserId}
            currentUserEmail={currentUserEmail}
          />
        )}
        {isLoading && (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3.5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800/50 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Main content: list + sidebar ── */}
        <div className="flex gap-5 items-start">
          {/* Left column: tabs + cards */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* ── Filter + view toggle ── */}
            <div className="flex items-center gap-2">
              <FilterSelect
                value={activeFilter}
                onChange={setActiveFilter}
                options={FILTER_OPTIONS.map((o) => ({
                  ...o,
                  label: o.value === "ALL"
                    ? `All (${tabCounts.ALL ?? 0})`
                    : `${o.label}${(tabCounts[o.value] ?? 0) > 0 ? ` (${tabCounts[o.value]})` : ""}`,
                }))}
              />
              {activeFilter !== "ALL" && (
                <button
                  onClick={() => setActiveFilter("ALL")}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors duration-150"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}

              {/* View mode toggle */}
              <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1 flex-shrink-0 ml-auto">
                <button
                  onClick={() => setViewMode("list")}
                  title="List view"
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400",
                    viewMode === "list"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  title="Calendar view"
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400",
                    viewMode === "calendar"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Error state ── */}
            {isError && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center">
                  <CalendarOff className="w-7 h-7 text-rose-500 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Failed to load leaves</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Something went wrong while fetching leave requests.
                  </p>
                </div>
                <button
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 rounded-lg transition-colors duration-150"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            )}

            {/* ── Loading skeleton ── */}
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            )}

            {/* ── Leave content (list or calendar) ── */}
            {!isLoading && !isError && viewMode === "calendar" && (
              <LeaveCalendar leaves={filteredLeaves} />
            )}

            {!isLoading && !isError && viewMode === "list" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredLeaves.length === 0 ? (
                  <EmptyState filter={activeFilter} onRequestLeave={() => setRequestOpen(true)} />
                ) : (
                  filteredLeaves.map((leave) => (
                    <LeaveCard
                      key={leave.id}
                      leave={leave}
                      currentUserId={currentUserId}
                      currentUserEmail={currentUserEmail}
                      currentUserRole={currentUserRole}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onCancel={handleCancel}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right column: Who's Out sidebar */}
          <div className="w-64 flex-shrink-0 hidden lg:block">
            <WhoIsOutPanel />
          </div>
        </div>

        {/* Mobile Who's Out (below on small screens) */}
        <div className="lg:hidden">
          <WhoIsOutPanel />
        </div>
      </div>

      {/* ── Modals ── */}
      <LeaveRequestForm
        open={requestOpen || Boolean(editLeaveData)}
        onOpenChange={(open) => {
          if (!open) {
            setRequestOpen(false);
            setEditLeaveData(null);
          }
        }}
        initialData={editLeaveData}
      />

      <ApprovalModal
        open={approvalModal.open}
        onOpenChange={(open) => setApprovalModal((prev) => ({ ...prev, open }))}
        action={approvalModal.action}
        leaveId={approvalModal.leaveId}
        onSuccess={handleApprovalSuccess}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
        variant="danger"
        title="Delete leave request"
        description="Are you sure you want to delete this leave request? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirm.id) {
            deleteLeave(deleteConfirm.id, { onError: (err) => console.error("Delete failed", err) });
          }
        }}
      />
    </LeaveErrorBoundary>
  );
}
