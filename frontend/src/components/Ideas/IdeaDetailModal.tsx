import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ThumbsUp, X, CheckCircle2, XCircle, ArrowRight, Rocket } from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import type { Idea, IdeaStatus } from "@/types";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; pill: string }> = {
  PRODUCT: { label: "Product", emoji: "📦", pill: "bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/60" },
  PROCESS: { label: "Process", emoji: "🔄", pill: "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60" },
  TECH: { label: "Tech", emoji: "💻", pill: "bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60" },
  CULTURE: { label: "Culture", emoji: "🌱", pill: "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60" },
  OTHER: { label: "Other", emoji: "🌀", pill: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700" },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  currentUserRole: "EMPLOYEE" | "MANAGER" | "ADMIN";
  onVote: (id: string) => void;
  isVotePending?: boolean;
  onStatusChange: (id: string, status: IdeaStatus) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IdeaDetailModal({
  idea,
  open,
  onOpenChange,
  currentUserId,
  currentUserRole,
  onVote,
  isVotePending = false,
  onStatusChange,
}: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [voteAnimating, setVoteAnimating] = useState(false);

  const isManagerOrAdmin = currentUserRole === "MANAGER" || currentUserRole === "ADMIN";
  const isOwnIdea = Boolean(idea && currentUserId && idea.author.azure_oid === currentUserId);
  const voteDisabled = isVotePending || voteAnimating;

  function handleVoteClick() {
    if (!idea || voteDisabled) return;
    setVoteAnimating(true);
    onVote(idea.id);
    setTimeout(() => setVoteAnimating(false), 300);
  }

  function handleStatusChange(status: IdeaStatus) {
    if (!idea) return;
    onStatusChange(idea.id, status);
    if (status !== "REJECTED") {
      onOpenChange(false);
    }
  }

  function handleConfirmReject() {
    if (!idea) return;
    onStatusChange(idea.id, "REJECTED");
    setRejecting(false);
    setRejectionNote("");
    onOpenChange(false);
  }

  function handleClose(open: boolean) {
    if (!open) {
      setRejecting(false);
      setRejectionNote("");
    }
    onOpenChange(open);
  }

  if (!idea) return null;

  const catCfg = CATEGORY_CONFIG[idea.category] ?? CATEGORY_CONFIG.OTHER;
  const initials = getInitials(idea.author.display_name);
  const relativeDate = formatDistanceToNow(parseISO(idea.created_at), { addSuffix: true });
  const fullDate = format(parseISO(idea.created_at), "MMM d, yyyy 'at' h:mm a");

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content */}
        <Dialog.Content
          className={cn(
            "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-2xl max-h-[90vh] overflow-y-auto",
            "bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "focus:outline-none"
          )}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Category + Status row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-none",
                      catCfg.pill
                    )}
                  >
                    <span>{catCfg.emoji}</span>
                    <span>{catCfg.label}</span>
                  </span>
                  <StatusBadge status={idea.status} size="sm" />
                </div>

                {/* Title */}
                <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                  {idea.title}
                </Dialog.Title>
              </div>

              {/* Close button */}
              <Dialog.Close className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 mt-0.5">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Description */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Description
              </h4>
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {idea.description}
                </p>
              </div>
            </div>

            {/* Author + date */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white text-xs font-bold leading-none">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {idea.author.display_name}
                </p>
                {idea.author.department && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{idea.author.department}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">{relativeDate}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{fullDate}</p>
              </div>
            </div>

            {/* Upvote */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleVoteClick}
                disabled={voteDisabled}
                title={idea.voted_by_me ? "Remove vote" : "Upvote"}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all duration-150",
                  idea.voted_by_me
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                  voteDisabled && "opacity-50 cursor-not-allowed",
                  voteAnimating && "scale-105"
                )}
              >
                <ThumbsUp
                  className={cn(
                    "w-4 h-4",
                    idea.voted_by_me ? "fill-indigo-500 text-indigo-500 dark:fill-indigo-400 dark:text-indigo-400" : "",
                    voteAnimating && "animate-bounce"
                  )}
                />
                <span>{idea.voted_by_me ? "Voted" : "Upvote"}</span>
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold",
                    idea.voted_by_me
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}
                >
                  {idea.upvote_count}
                </span>
              </button>

              <span className="text-xs text-slate-400">
                {idea.upvote_count === 1 ? "1 person thinks this is a great idea" : `${idea.upvote_count} people think this is a great idea`}
              </span>
            </div>

            {/* Manager actions */}
            {isManagerOrAdmin && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Manager Actions
                </h4>

                {/* SUBMITTED → UNDER_REVIEW */}
                {idea.status === "SUBMITTED" && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStatusChange("UNDER_REVIEW")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors duration-150 shadow-sm"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Move to Review
                    </button>
                    <span className="text-xs text-slate-400">
                      Start reviewing this idea
                    </span>
                  </div>
                )}

                {/* UNDER_REVIEW → APPROVED or REJECTED */}
                {idea.status === "UNDER_REVIEW" && !rejecting && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => handleStatusChange("APPROVED")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors duration-150 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-sm font-medium rounded-xl transition-colors duration-150"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}

                {/* Rejection note panel */}
                {idea.status === "UNDER_REVIEW" && rejecting && (
                  <div className="space-y-3 p-4 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-800/60">
                    <label className="block text-sm font-medium text-rose-700 dark:text-rose-300">
                      Rejection reason (optional)
                    </label>
                    <textarea
                      value={rejectionNote}
                      onChange={(e) => setRejectionNote(e.target.value)}
                      placeholder="Explain why this idea is being rejected..."
                      rows={3}
                      className="w-full text-sm border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2 resize-y bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleConfirmReject}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors duration-150"
                      >
                        <XCircle className="w-4 h-4" />
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => { setRejecting(false); setRejectionNote(""); }}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors duration-150"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* APPROVED → IMPLEMENTED */}
                {idea.status === "APPROVED" && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStatusChange("IMPLEMENTED")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors duration-150 shadow-sm"
                    >
                      <Rocket className="w-4 h-4" />
                      Mark Implemented
                    </button>
                    <span className="text-xs text-slate-400">
                      Mark this idea as shipped
                    </span>
                  </div>
                )}

                {/* Terminal states */}
                {(idea.status === "REJECTED" || idea.status === "IMPLEMENTED") && (
                  <p className="text-xs text-slate-400 italic">
                    {idea.status === "REJECTED"
                      ? "This idea has been rejected. No further actions available."
                      : "This idea has been implemented. Congratulations!"}
                  </p>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
