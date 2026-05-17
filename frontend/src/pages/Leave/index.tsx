import { useState, useMemo, Component } from "react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";
import { useMsal, useAccount } from "@azure/msal-react";
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
} from "lucide-react";
import { format, parseISO, isThisMonth } from "date-fns";
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
          <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
            <CalendarOff className="w-8 h-8 text-rose-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800">Something went wrong</p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">{this.state.message}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors duration-150"
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
      <div className="h-1 bg-slate-200 w-full" />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-3/5" />
            <div className="h-2.5 bg-slate-100 rounded w-2/5" />
          </div>
          <div className="h-5 w-16 bg-slate-200 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-200 rounded w-2/5" />
            <div className="h-2.5 bg-slate-100 rounded w-3/5" />
          </div>
        </div>
        <div className="bg-slate-100 rounded-lg px-3 py-2.5 space-y-1.5">
          <div className="h-2.5 bg-slate-200 rounded w-full" />
          <div className="h-2.5 bg-slate-200 rounded w-4/5" />
        </div>
      </div>
    </div>
  );
}

// ─── Who Is Out Panel ─────────────────────────────────────────────────────────

function WhoIsOutPanel() {
  const { data, isLoading, isError } = useWhoIsOut();

  return (
    <aside className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
          <Users className="w-3.5 h-3.5 text-rose-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">Who's Out Today</h2>
      </div>

      <div className="p-3 space-y-2">
        {isLoading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-2 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 bg-slate-200 rounded w-3/5" />
                  <div className="h-2 bg-slate-100 rounded w-2/5" />
                </div>
              </div>
            ))}
          </>
        )}

        {isError && (
          <p className="text-xs text-slate-500 px-2 py-3 text-center">
            Unable to load. Try refreshing.
          </p>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div className="text-center py-6 px-3">
            <div className="text-2xl mb-1">🏢</div>
            <p className="text-xs font-medium text-slate-700">Everyone's in!</p>
            <p className="text-xs text-slate-400 mt-0.5">No one is out today.</p>
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
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors duration-150"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-white text-[9px] font-bold leading-none">{initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate leading-tight">
                    {entry.user.display_name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TypeIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <p className="text-[10px] text-slate-500 truncate">
                      {LEAVE_TYPE_LABELS[entry.leave_type]}
                    </p>
                    <span className="text-slate-300 flex-shrink-0">·</span>
                    <p className="text-[10px] text-slate-400 truncate">
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

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

type FilterTab = "ALL" | LeaveStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
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
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
    },
    {
      label: "Approved This Month",
      value: approvedThisMonth,
      icon: CheckCircle2,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700",
    },
    {
      label: "Days Remaining",
      value: daysRemaining,
      icon: CalendarCheck2,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      valueColor: "text-indigo-700",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value, icon: Icon, iconBg, iconColor, valueColor }) => (
        <div
          key={label}
          className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5 flex items-center gap-3"
        >
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", iconBg)}>
            <Icon className={cn("w-[18px] h-[18px]", iconColor)} />
          </div>
          <div className="min-w-0">
            <p className={cn("text-xl font-bold leading-none", valueColor)}>{value}</p>
            <p className="text-xs text-slate-500 mt-1 leading-tight">{label}</p>
          </div>
        </div>
      ))}
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
      <p className="text-base font-semibold text-slate-800">{config.title}</p>
      <p className="text-sm text-slate-500 mt-1 max-w-xs">{config.body}</p>
      {filter === "ALL" && (
        <button
          onClick={onRequestLeave}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors duration-150 shadow-sm shadow-indigo-200"
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
  const [approvalModal, setApprovalModal] = useState<{
    open: boolean;
    action: "approve" | "reject";
    leaveId: string;
  }>({ open: false, action: "approve", leaveId: "" });

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
    if (window.confirm("Are you sure you want to delete this leave request?")) {
      deleteLeave(id, { onError: (err) => console.error("Delete failed", err) });
    }
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leave Tracker</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage and review leave requests across your team.
            </p>
          </div>
          <button
            onClick={() => setRequestOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all duration-150 shadow-sm shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
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
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-200 flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-slate-200 rounded w-1/3" />
                    <div className="h-2.5 bg-slate-100 rounded w-3/4" />
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
            {/* ── Filter tabs ── */}
            <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1 overflow-x-auto scrollbar-hide">
              {FILTER_TABS.map(({ key, label }) => {
                const count = tabCounts[key] ?? 0;
                const isActive = activeFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-400",
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    {label}
                    {count > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-200 text-slate-600",
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Error state ── */}
            {isError && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center">
                  <CalendarOff className="w-7 h-7 text-rose-500" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-800">Failed to load leaves</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Something went wrong while fetching leave requests.
                  </p>
                </div>
                <button
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors duration-150"
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

            {/* ── Leave cards grid ── */}
            {!isLoading && !isError && (
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
    </LeaveErrorBoundary>
  );
}
