import { useState, useMemo } from "react";
import { useAccount, useMsal } from "@azure/msal-react";
import {
  Lightbulb,
  Plus,
  Search,
  LayoutGrid,
  List,
  Filter,
  TrendingUp,
  Clock,
  Rocket,
  Loader2,
  AlertCircle,
  User,
  CalendarDays,
  X,
} from "lucide-react";
import { parseISO, isAfter, subDays, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIdeas, useVoteIdea, useUpdateIdea } from "@/hooks/useIdeas";
import KanbanBoard from "@/components/KanbanBoard";
import IdeaCard from "@/components/Ideas/IdeaCard";
import IdeaDetailModal from "@/components/Ideas/IdeaDetailModal";
import IdeaSubmitForm from "@/components/Ideas/IdeaSubmitForm";
import LeaderboardModal from "@/components/Ideas/LeaderboardModal";
import { Trophy } from "lucide-react";
import type { Idea, IdeaCategory, IdeaStatus, UserRole } from "@/types";

// ─── Category options ─────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: IdeaCategory | "ALL"; label: string; emoji: string }[] = [
  { value: "ALL", label: "All Categories", emoji: "🔍" },
  { value: "PRODUCT", label: "Product", emoji: "📦" },
  { value: "PROCESS", label: "Process", emoji: "🔄" },
  { value: "TECH", label: "Tech", emoji: "💻" },
  { value: "CULTURE", label: "Culture", emoji: "🌱" },
  { value: "OTHER", label: "Other", emoji: "🌀" },
];

const STATUS_OPTIONS: { value: IdeaStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "IMPLEMENTED", label: "Implemented" },
];

type DateFilter = "ALL" | "WEEK" | "MONTH" | "YEAR" | "30D" | "90D";

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "ALL", label: "All Time" },
  { value: "WEEK", label: "This Week" },
  { value: "MONTH", label: "This Month" },
  { value: "30D", label: "Last 30 Days" },
  { value: "90D", label: "Last 90 Days" },
  { value: "YEAR", label: "This Year" },
];

function isAfterDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === "ALL") return true;
  const date = parseISO(dateStr);
  const now = new Date();
  if (filter === "WEEK") return isAfter(date, startOfWeek(now));
  if (filter === "MONTH") return isAfter(date, startOfMonth(now));
  if (filter === "YEAR") return isAfter(date, startOfYear(now));
  if (filter === "30D") return isAfter(date, subDays(now, 30));
  if (filter === "90D") return isAfter(date, subDays(now, 90));
  return true;
}

// ─── View type ────────────────────────────────────────────────────────────────

type ViewMode = "board" | "list";

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  valueColor: string;
}

function StatCard({ label, value, icon, accent, valueColor }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", accent)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{label}</p>
        <p className={cn("text-2xl font-bold leading-tight mt-0.5", valueColor)}>{value}</p>
      </div>
    </div>
  );
}

// ─── Simple select helper ─────────────────────────────────────────────────────

interface SimpleSelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; emoji?: string }[];
  placeholder?: string;
  className?: string;
}

function SimpleSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className,
}: SimpleSelectProps<T>) {
  const selected = options.find((o) => o.value === value);

  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <Select.Trigger
        className={cn(
          "inline-flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200",
          "hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400",
          "whitespace-nowrap",
          className
        )}
      >
        {selected?.emoji && <span className="text-base leading-none">{selected.emoji}</span>}
        <Select.Value placeholder={placeholder}>
          {selected?.label ?? placeholder}
        </Select.Value>
        <Select.Icon>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden min-w-[160px]"
        >
          <Select.Viewport className="p-1">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer outline-none",
                  "data-[highlighted]:bg-indigo-50 dark:data-[highlighted]:bg-indigo-950/50 data-[highlighted]:text-indigo-700 dark:data-[highlighted]:text-indigo-300",
                  "data-[state=checked]:font-medium"
                )}
              >
                {opt.emoji && <span>{opt.emoji}</span>}
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const { accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);

  // Derive user info from MSAL account. Role would normally come from your API.
  // We read it from account's ID token claims (idTokenClaims) if present, else default EMPLOYEE.
  const currentUserId: string = account?.localAccountId ?? "";
  const rawRole = (account?.idTokenClaims as Record<string, unknown> | undefined)?.role;
  const currentUserRole: UserRole =
    rawRole === "MANAGER" || rawRole === "ADMIN" ? (rawRole as UserRole) : "EMPLOYEE";

  // View & filter state
  const [view, setView] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IdeaCategory | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | "ALL">("ALL");
  const [authorFilter, setAuthorFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");

  // Modal state
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  // Data
  const { data: ideas = [], isLoading, isError, error } = useIdeas();
  const { mutate: voteIdea, isPending: isVotePending } = useVoteIdea();
  const { mutate: updateIdea } = useUpdateIdea();

  // Unique authors derived from loaded ideas (for the author dropdown)
  const authorOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: "ALL", label: "All Authors" }];
    for (const idea of ideas) {
      if (!seen.has(idea.author.id)) {
        seen.add(idea.author.id);
        opts.push({ value: idea.author.id, label: idea.author.display_name });
      }
    }
    return opts;
  }, [ideas]);

  // Filtered ideas for list view (board groups internally)
  const filteredIdeas = useMemo(() => {
    let list = ideas;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.author.display_name.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "ALL") {
      list = list.filter((i) => i.category === categoryFilter);
    }
    if (statusFilter !== "ALL") {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (authorFilter !== "ALL") {
      list = list.filter((i) => i.author.id === authorFilter);
    }
    if (dateFilter !== "ALL") {
      list = list.filter((i) => isAfterDateFilter(i.created_at, dateFilter));
    }
    return list;
  }, [ideas, search, categoryFilter, statusFilter, authorFilter, dateFilter]);

  // When any filter is active the board shows mostly empty columns, so force list
  const isFiltered = Boolean(search.trim()) || categoryFilter !== "ALL" || statusFilter !== "ALL" || authorFilter !== "ALL" || dateFilter !== "ALL";
  const effectiveView: ViewMode = isFiltered ? "list" : view;

  // Stats
  const totalIdeas = ideas.length;
  const underReview = ideas.filter((i) => i.status === "UNDER_REVIEW").length;
  const implemented = ideas.filter((i) => i.status === "IMPLEMENTED").length;

  const selectedIdea = useMemo(() => {
    return ideas.find((i) => i.id === selectedIdeaId) ?? null;
  }, [ideas, selectedIdeaId]);

  function handleVote(id: string) {
    voteIdea(id);
  }

  function handleStatusChange(id: string, status: IdeaStatus) {
    updateIdea({ id, payload: { status } });
  }

  function handleCardClick(idea: Idea) {
    setSelectedIdeaId(idea.id);
    setDetailOpen(true);
  }

  function handleDetailClose(open: boolean) {
    setDetailOpen(open);
    if (!open) setSelectedIdeaId(null);
  }

  return (
    <div className="space-y-5">
      {/* ─── Page header ─── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
              Innovation Hub
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit ideas and track their progress
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setLeaderboardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-sm font-bold rounded-xl transition-colors duration-150 shadow-sm"
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            Leaderboard & Scoring
          </button>

          <button
            onClick={() => setSubmitOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl transition-colors duration-150 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Submit Idea
          </button>
        </div>
      </div>

      {/* ─── Stats strip ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Ideas"
          value={totalIdeas}
          icon={<Lightbulb className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          accent="bg-indigo-50 dark:bg-indigo-950/80"
          valueColor="text-indigo-700 dark:text-indigo-300"
        />
        <StatCard
          label="Under Review"
          value={underReview}
          icon={<Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          accent="bg-amber-50 dark:bg-amber-950/80"
          valueColor="text-amber-700 dark:text-amber-300"
        />
        <StatCard
          label="Implemented"
          value={implemented}
          icon={<Rocket className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          accent="bg-emerald-50 dark:bg-emerald-950/80"
          valueColor="text-emerald-700 dark:text-emerald-300"
        />
      </div>

      {/* ─── Toolbar: view toggle + filters ─── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle — board is disabled while filters are active */}
        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 gap-0.5">
          <button
            onClick={() => setView("board")}
            disabled={isFiltered}
            title={isFiltered ? "Clear filters to switch to board view" : undefined}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
              effectiveView === "board"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                : isFiltered
                ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Board
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
              effectiveView === "list"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ideas..."
            className={cn(
              "w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500",
              "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400",
              "hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150"
            )}
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <SimpleSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={CATEGORY_OPTIONS}
          />
        </div>

        {/* Status filter */}
        <SimpleSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
        />

        {/* Author filter */}
        {authorOptions.length > 2 && (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <SimpleSelect
              value={authorFilter}
              onChange={setAuthorFilter}
              options={authorOptions}
            />
          </div>
        )}

        {/* Date filter */}
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <SimpleSelect
            value={dateFilter}
            onChange={setDateFilter}
            options={DATE_FILTER_OPTIONS}
          />
        </div>

        {/* Results count + reset */}
        {isFiltered && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-400">
              {filteredIdeas.length} result{filteredIdeas.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => {
                setSearch("");
                setCategoryFilter("ALL");
                setStatusFilter("ALL");
                setAuthorFilter("ALL");
                setDateFilter("ALL");
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors duration-150"
            >
              <X className="w-3 h-3" />
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* ─── Loading state ─── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Loading ideas...</p>
          </div>
        </div>
      )}

      {/* ─── Error state ─── */}
      {isError && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Failed to load ideas</p>
              <p className="text-xs text-slate-400 mt-1">
                {error instanceof Error ? error.message : "Please try refreshing the page"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Board view ─── */}
      {!isLoading && !isError && effectiveView === "board" && (
        <div className="overflow-x-auto -mx-6 px-6">
          <KanbanBoard
            ideas={filteredIdeas}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onVote={handleVote}
            isVotePending={isVotePending}
            onStatusChange={handleStatusChange}
            onCardClick={handleCardClick}
            statusFilter={statusFilter}
          />
        </div>
      )}

      {/* ─── List view ─── */}
      {!isLoading && !isError && effectiveView === "list" && (
        <div>
          {filteredIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No ideas found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {search || categoryFilter !== "ALL" || statusFilter !== "ALL" || authorFilter !== "ALL" || dateFilter !== "ALL"
                    ? "Try adjusting your filters"
                    : "Be the first to submit an idea!"}
                </p>
              </div>
              {!search && categoryFilter === "ALL" && statusFilter === "ALL" && authorFilter === "ALL" && dateFilter === "ALL" && (
                <button
                  onClick={() => setSubmitOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors duration-150"
                >
                  <Plus className="w-4 h-4" />
                  Submit the first idea
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onVote={handleVote}
                  isVotePending={isVotePending}
                  onStatusChange={handleStatusChange}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Modals ─── */}
      <IdeaDetailModal
        idea={selectedIdea}
        open={detailOpen}
        onOpenChange={handleDetailClose}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onVote={handleVote}
        isVotePending={isVotePending}
        onStatusChange={handleStatusChange}
      />
      <IdeaSubmitForm open={submitOpen} onOpenChange={setSubmitOpen} />
      <LeaderboardModal open={leaderboardOpen} onOpenChange={setLeaderboardOpen} />
    </div>
  );
}
