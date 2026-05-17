import { useState } from "react";
import type { ComponentType } from "react";
import {
  Calendar,
  CalendarDays,
  Stethoscope,
  DollarSign,
  Baby,
  Heart,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Ban,
  MessageSquare,
  Pencil,
  Trash2,
  Laptop,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import type { Leave, UserRole } from "@/types";

interface Props {
  leave: Leave;
  currentUserId: string;
  currentUserEmail?: string;
  currentUserRole: UserRole;
  onApprove?: (id: string, comment?: string) => void;
  onReject?: (id: string, comment?: string) => void;
  onCancel?: (id: string) => void;
  onEdit?: (leave: Leave) => void;
  onDelete?: (id: string) => void;
}

interface LeaveTypeMeta {
  icon: ComponentType<{ className?: string }>;
  label: string;
  iconBg: string;
  iconColor: string;
}

const LEAVE_TYPE_META: Record<string, LeaveTypeMeta> = {
  ANNUAL: {
    icon: CalendarDays,
    label: "Annual Leave",
    iconBg: "bg-indigo-100 dark:bg-indigo-950/80",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  SICK: {
    icon: Stethoscope,
    label: "Sick Leave",
    iconBg: "bg-rose-100 dark:bg-rose-950/80",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  UNPAID: {
    icon: DollarSign,
    label: "Unpaid Leave",
    iconBg: "bg-amber-100 dark:bg-amber-950/80",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  PARENTAL: {
    icon: Baby,
    label: "Parental Leave",
    iconBg: "bg-emerald-100 dark:bg-emerald-950/80",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  BEREAVEMENT: {
    icon: Heart,
    label: "Bereavement",
    iconBg: "bg-purple-100 dark:bg-purple-950/80",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  WFH: {
    icon: Laptop,
    label: "Work From Home",
    iconBg: "bg-cyan-100 dark:bg-cyan-950/80",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
};

function formatDateRange(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();

  if (sameMonth && s.getDate() === e.getDate()) {
    return format(s, "MMM d, yyyy");
  }
  if (sameMonth) {
    return `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`;
  }
  if (sameYear) {
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  }
  return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
}

export default function LeaveCard({
  leave,
  currentUserId,
  currentUserEmail,
  currentUserRole,
  onApprove,
  onReject,
  onCancel,
  onEdit,
  onDelete,
}: Props) {
  const [reasonExpanded, setReasonExpanded] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const meta = LEAVE_TYPE_META[leave.leave_type] ?? LEAVE_TYPE_META["ANNUAL"];
  const TypeIcon = meta.icon;

  const initials = getInitials(leave.user.display_name);
  const dateRange = formatDateRange(leave.start_date, leave.end_date);
  const daysLabel = `${leave.days} ${leave.days === 1 ? "day" : "days"}`;

  const isOwnLeave =
    leave.user_id === currentUserId ||
    (Boolean(currentUserEmail) && leave.user.email.toLowerCase() === currentUserEmail?.toLowerCase());

  const isPending = leave.status === "PENDING";
  const isCancelled = leave.status === "CANCELLED";

  const isManagerOrAbove = ["MANAGER", "ADMIN", "OWNER"].includes(currentUserRole);

  const showManagerActions = isManagerOrAbove && isPending && !isOwnLeave;
  const showCancelAction = isOwnLeave && isPending;
  const showDeleteOnly = isOwnLeave && isCancelled;

  const reasonTruncated = leave.reason.length > 120;
  const displayReason =
    reasonTruncated && !reasonExpanded
      ? `${leave.reason.slice(0, 120)}…`
      : leave.reason;

  function handleRejectConfirm() {
    if (!rejectComment.trim()) return;
    onReject?.(leave.id, rejectComment.trim());
    setRejectOpen(false);
    setRejectComment("");
  }

  return (
    <article
      className={cn(
        "relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden",
        "transition-all duration-200 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700",
        "flex flex-col justify-between p-6 gap-4",
      )}
    >
      {/* Top row: Applicant + Badge */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-tight truncate">
              {leave.user.display_name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {leave.user.department ?? "Organization"}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-1">
          <StatusBadge status={leave.status} />
        </div>
      </div>

      {/* Date range & Days pill */}
      <div className="flex items-center gap-2 flex-wrap py-2 border-y border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <span>{dateRange}</span>
        </div>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {daysLabel}
        </span>
      </div>

      {/* Leave type + Reason */}
      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", meta.iconBg)}>
            <TypeIcon className={cn("w-3.5 h-3.5", meta.iconColor)} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {meta.label}
          </span>
        </div>

        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p className="inline">{displayReason}</p>
          {reasonTruncated && (
            <button
              type="button"
              onClick={() => setReasonExpanded(!reasonExpanded)}
              className="ml-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 focus:outline-none"
            >
              {reasonExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* Approver info (if approved/rejected) */}
        {leave.approver && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-800/50 -mx-6 -mb-2 px-6 py-3">
            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <span className="text-slate-400 dark:text-slate-500">Reviewed by:</span>
              <span>{leave.approver.display_name}</span>
            </div>
            {leave.approver_comment && (
              <p className="text-slate-600 dark:text-slate-400 italic">“{leave.approver_comment}”</p>
            )}
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="mt-auto pt-2">
        {/* Reject reason input popover */}
        {rejectOpen && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in-50 slide-in-from-top-1">
            <div>
              <label htmlFor={`reject-${leave.id}`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason for Rejection <span className="text-rose-500">*</span>
              </label>
              <textarea
                id={`reject-${leave.id}`}
                rows={2}
                required
                autoFocus
                placeholder="Explain why this request is being rejected..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectOpen(false);
                  setRejectComment("");
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectComment.trim()}
                onClick={handleRejectConfirm}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all duration-150"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {(showManagerActions || showCancelAction || showDeleteOnly) && !rejectOpen && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            {showManagerActions && (
              <>
                <button
                  type="button"
                  onClick={() => onApprove?.(leave.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-600 dark:hover:border-emerald-500 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRejectOpen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-200 dark:border-rose-800/60 hover:border-rose-600 dark:hover:border-rose-500 transition-all"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              </>
            )}
            {showCancelAction && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit?.(leave)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-200 dark:border-indigo-800/60 hover:border-indigo-600 dark:hover:border-indigo-500 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onCancel?.(leave.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-600 hover:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-600 transition-all"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(leave.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-200 dark:border-rose-800/60 hover:border-rose-600 dark:hover:border-rose-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </>
            )}
            {showDeleteOnly && (
              <button
                type="button"
                onClick={() => onDelete?.(leave.id)}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-rose-400",
                  "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-200 dark:border-rose-800/60 hover:border-rose-600 hover:shadow-sm",
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
