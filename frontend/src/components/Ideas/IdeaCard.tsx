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
    pill: "bg-violet-100 text-violet-700 border-violet-200",
  },
  PROCESS: {
    label: "Process",
    emoji: "🔄",
    pill: "bg-amber-100 text-amber-700 border-amber-200",
  },
  TECH: {
    label: "Tech",
    emoji: "💻",
    pill: "bg-sky-100 text-sky-700 border-sky-200",
  },
  CULTURE: {
    label: "Culture",
    emoji: "🌱",
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  OTHER: {
    label: "Other",
    emoji: "🌀",
    pill: "bg-slate-100 text-slate-600 border-slate-200",
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
        "group bg-white rounded-xl border border-slate-100 shadow-sm cursor-pointer",
        "transition-all duration-200 ease-out",
        "hover:shadow-md hover:-translate-y-0.5",
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
        <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
          {idea.title}
        </h3>
      </div>

      {/* Description */}
      <div className="px-4 pb-3">
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
          {idea.description}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-100" />

      {/* Bottom row: author + upvote + date */}
      <div className="px-4 py-3 flex items-center gap-2">
        {/* Author avatar */}
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white text-[9px] font-bold leading-none">
            {initials}
          </span>
        </div>

        {/* Author name */}
        <span className="text-xs text-slate-500 flex-1 truncate min-w-0">
          {idea.author.display_name}
        </span>

        {/* Date */}
        <span className="text-[10px] text-slate-400 flex-shrink-0 hidden sm:block">
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
              ? "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
              : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700",
            voteDisabled && "opacity-40 cursor-not-allowed",
            voteAnimating && "scale-110"
          )}
        >
          <ThumbsUp
            className={cn(
              "w-3 h-3 transition-transform duration-150",
              idea.voted_by_me ? "fill-indigo-500 text-indigo-500" : "",
              voteAnimating && "animate-bounce"
            )}
          />
          <span>{idea.upvote_count}</span>
        </button>
      </div>
    </article>
  );
}
