import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import type { Idea, IdeaStatus } from "@/types";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { label: string; emoji: string; pill: string }
> = {
  PRODUCT: {
    label: "Product",
    emoji: "📦",
    pill: "bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/60",
  },
  PROCESS: {
    label: "Process",
    emoji: "🔄",
    pill: "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
  },
  TECH: {
    label: "Tech",
    emoji: "💻",
    pill: "bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
  },
  CULTURE: {
    label: "Culture",
    emoji: "🌱",
    pill: "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  },
  OTHER: {
    label: "Other",
    emoji: "🌀",
    pill: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  idea: Idea;
  currentUserId: string;
  currentUserRole: "EMPLOYEE" | "MANAGER" | "ADMIN";
  onVote: (id: string) => void;
  isVotePending?: boolean;
  onStatusChange?: (id: string, status: IdeaStatus) => void;
  onClick: (idea: Idea) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IdeaCard({
  idea,
  currentUserId,
  onVote,
  isVotePending = false,
  onClick,
}: Props) {
  const [voteAnimating, setVoteAnimating] = useState(false);

  const catCfg = CATEGORY_CONFIG[idea.category] ?? CATEGORY_CONFIG.OTHER;
  const initials = getInitials(idea.author.display_name);
  const relativeDate = formatDistanceToNow(parseISO(idea.created_at), {
    addSuffix: true,
  });

  function handleVoteClick(e: React.MouseEvent) {
    e.stopPropagation();
    setVoteAnimating(true);
    onVote(idea.id);
    setTimeout(() => setVoteAnimating(false), 300);
  }

  const isOwnIdea = Boolean(currentUserId && idea.author.azure_oid === currentUserId);
  const voteDisabled = isVotePending || voteAnimating;

  return (
    <article
      onClick={() => onClick(idea)}
      className={cn(
        "group bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer",
        "transition-all duration-200 ease-out",
        "hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 hover:-translate-y-0.5",
        "select-none"
      )}
    >
      {/* Top row: category pill + status dot */}
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
            catCfg.pill
          )}
        >
          <span>{catCfg.emoji}</span>
          <span>{catCfg.label}</span>
        </span>
        <StatusBadge status={idea.status} size="sm" />
      </div>

      {/* Title */}
      <div className="px-4 pb-1.5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">
          {idea.title}
        </h3>
      </div>

      {/* Description */}
      <div className="px-4 pb-3">
        <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed line-clamp-3">
          {idea.description}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-100 dark:border-slate-800" />

      {/* Bottom row: author + upvote + date */}
      <div className="px-4 py-3 flex items-center gap-2">
        {/* Author avatar */}
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white text-[9px] font-bold leading-none">
            {initials}
          </span>
        </div>

        {/* Author name */}
        <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 truncate min-w-0">
          {idea.author.display_name}
        </span>

        {/* Date */}
        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 hidden sm:block">
          {relativeDate}
        </span>

        {/* Vote button */}
        <button
          onClick={handleVoteClick}
          disabled={voteDisabled}
          title={idea.voted_by_me ? "Remove vote" : "Upvote"}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all duration-150 flex-shrink-0",
            idea.voted_by_me
              ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200",
            voteDisabled && "opacity-40 cursor-not-allowed",
            voteAnimating && "scale-110"
          )}
        >
          <ThumbsUp
            className={cn(
              "w-3 h-3 transition-transform duration-150",
              idea.voted_by_me ? "fill-indigo-500 text-indigo-500 dark:fill-indigo-400 dark:text-indigo-400" : "",
              voteAnimating && "animate-bounce"
            )}
          />
          <span>{idea.upvote_count}</span>
        </button>
      </div>
    </article>
  );
}
