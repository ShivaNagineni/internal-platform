import * as Dialog from "@radix-ui/react-dialog";
import { X, Trophy, Sparkles, ThumbsUp, CheckCircle2, Rocket, Award, Loader2 } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useUsers } from "@/hooks/useUsers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCORING_CRITERIA = [
  {
    title: "Idea Submission",
    points: "+5 Pts",
    desc: "Awarded when an idea is successfully added to the Innovation Hub.",
    icon: Sparkles,
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-50 border-amber-100 text-amber-700",
  },
  {
    title: "Team Endorsement",
    points: "+10 Pts",
    desc: "Awarded for each peer vote received during the weekly discussion.",
    icon: ThumbsUp,
    color: "from-blue-500 to-indigo-500",
    bg: "bg-blue-50 border-blue-100 text-blue-700",
  },
  {
    title: "Merit Selection",
    points: "+20 Pts",
    desc: "Awarded when the team votes an idea into the active Sprint (Review/Approved).",
    icon: CheckCircle2,
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50 border-emerald-100 text-emerald-700",
  },
  {
    title: "Execution Milestone",
    points: "+50 Pts",
    desc: "Awarded upon successful deployment/delivery of the feature.",
    icon: Rocket,
    color: "from-purple-500 to-pink-500",
    bg: "bg-purple-50 border-purple-100 text-purple-700",
  },
];

export default function LeaderboardModal({ open, onOpenChange }: Props) {
  const { data: users = [], isLoading } = useUsers("points");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className={cn(
            "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-3xl max-h-[90vh] overflow-y-auto",
            "bg-white rounded-2xl shadow-2xl border border-slate-100",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "focus:outline-none"
          )}
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-t-2xl relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <Trophy className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <Dialog.Title className="text-2xl font-bold leading-tight">
                    Innovation Leaderboard & Scoring
                  </Dialog.Title>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Recognizing top contributors driving platform innovation
                  </p>
                </div>
              </div>

              <Dialog.Close className="flex-shrink-0 p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors duration-150">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Scoring Framework */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                  The Scoring Framework
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SCORING_CRITERIA.map((crit, idx) => {
                  const Icon = crit.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-slate-200 transition-all duration-200 flex items-start gap-4 group"
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm text-white group-hover:scale-105 transition-transform duration-200",
                          crit.color
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {crit.title}
                          </h4>
                          <span
                            className={cn(
                              "text-xs font-black px-2 py-0.5 rounded-full border leading-tight flex-shrink-0",
                              crit.bg
                            )}
                          >
                            {crit.points}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {crit.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leaderboard */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                    Top Contributors Leaderboard
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  {users.length} Active Member{users.length !== 1 ? "s" : ""}
                </span>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {users.map((user, idx) => {
                    const rank = idx + 1;
                    let rankBadge = (
                      <span className="w-7 h-7 rounded-lg bg-slate-100 font-bold text-slate-600 flex items-center justify-center text-xs">
                        #{rank}
                      </span>
                    );
                    if (rank === 1) {
                      rankBadge = (
                        <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 font-black flex items-center justify-center text-sm shadow-sm" title="Rank 1">
                          🥇
                        </span>
                      );
                    } else if (rank === 2) {
                      rankBadge = (
                        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-black flex items-center justify-center text-sm shadow-sm" title="Rank 2">
                          🥈
                        </span>
                      );
                    } else if (rank === 3) {
                      rankBadge = (
                        <span className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 border border-orange-200 font-black flex items-center justify-center text-sm shadow-sm" title="Rank 3">
                          🥉
                        </span>
                      );
                    }

                    const initials = getInitials(user.display_name);

                    return (
                      <div
                        key={user.id}
                        className={cn(
                          "flex items-center gap-4 p-3.5 rounded-xl border border-slate-100 transition-all duration-150 bg-white",
                          rank === 1 && "border-amber-200 bg-amber-50/20 shadow-sm",
                          rank === 2 && "border-slate-200 bg-slate-50/20",
                          rank === 3 && "border-orange-200 bg-orange-50/20",
                          "hover:shadow-md hover:border-indigo-200"
                        )}
                      >
                        <div className="flex-shrink-0">{rankBadge}</div>

                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
                          {initials}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {user.display_name}
                            </h4>
                            {user.role === "ADMIN" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 flex-shrink-0">
                                ADMIN
                              </span>
                            )}
                          </div>
                          {user.department && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {user.department}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 flex-shrink-0 shadow-inner">
                          <Award className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-extrabold text-indigo-700">
                            {user.points} <span className="text-xs font-semibold text-indigo-500 uppercase">pts</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
