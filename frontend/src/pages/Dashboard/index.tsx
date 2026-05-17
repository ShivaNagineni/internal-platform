import { useMsal, useAccount } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  UserX,
  Lightbulb,
  Rocket,
  CalendarDays,
  ArrowRight,
  ThumbsUp,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useDashboardStats, useWhoIsOut } from "@/hooks/useDashboard";
import { useIdeas } from "@/hooks/useIdeas";
import { useReleases } from "@/hooks/useReleases";
import WhoIsOut from "@/components/WhoIsOut";
import StatusBadge from "@/components/StatusBadge";
import type { Idea, Release } from "@/types";

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(displayName: string): string {
  return displayName.split(" ")[0] ?? displayName;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: {
    bg: string;
    icon: string;
    value: string;
  };
  loading?: boolean;
}

function StatCard({ label, value, icon: Icon, colorClasses, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow duration-200">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", colorClasses.bg)}>
        <Icon className={cn("w-6 h-6", colorClasses.icon)} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="animate-pulse space-y-1.5">
            <div className="h-7 w-12 bg-slate-200 rounded-md" />
            <div className="h-3 w-24 bg-slate-100 rounded-full" />
          </div>
        ) : (
          <>
            <p className={cn("text-2xl font-bold leading-none tabular-nums", colorClasses.value)}>
              {value ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-tight">{label}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------
function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-100 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  action?: React.ReactNode;
}

function CardHeader({ title, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton list rows
// ---------------------------------------------------------------------------
function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 py-3 animate-pulse">
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-slate-200 rounded-full w-48" />
        <div className="h-2.5 bg-slate-100 rounded-full w-32" />
      </div>
      <div className="h-5 w-16 bg-slate-200 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent ideas mini list
// ---------------------------------------------------------------------------
function RecentIdeaRow({ idea }: { idea: Idea }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">
          {idea.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400 truncate">{idea.author.display_name}</span>
          {idea.upvote_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <ThumbsUp className="w-3 h-3" />
              {idea.upvote_count}
            </span>
          )}
        </div>
      </div>
      <StatusBadge status={idea.status} size="sm" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming releases mini list
// ---------------------------------------------------------------------------
function UpcomingReleaseRow({ release }: { release: Release }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">
          {release.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-slate-400">{release.version}</span>
          {release.release_date && (
            <span className="text-xs text-slate-400">
              {format(new Date(`${release.release_date}T00:00:00`), "MMM d, yyyy")}
            </span>
          )}
        </div>
      </div>
      <StatusBadge status={release.status} size="sm" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Actions card
// ---------------------------------------------------------------------------
interface QuickActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  colorClasses: string;
  onClick: () => void;
}

function QuickActionButton({
  icon: Icon,
  label,
  description,
  colorClasses,
  onClick,
}: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-150 group hover:shadow-sm text-left",
        colorClasses
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="text-xs opacity-70 mt-0.5 leading-tight">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const { accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);
  const navigate = useNavigate();

  const displayName = account?.name ?? "there";
  const firstName = getFirstName(displayName);
  const greeting = getGreeting();
  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: whoIsOut, isLoading: whoIsOutLoading } = useWhoIsOut();
  const { data: ideas, isLoading: ideasLoading } = useIdeas();
  const { data: releases, isLoading: releasesLoading } = useReleases();

  // Latest 3 ideas
  const recentIdeas = ideas?.slice(0, 3) ?? [];

  // Next 3 upcoming releases (PLANNED or IN_PROGRESS, sorted by release_date asc)
  const upcomingReleases = (releases ?? [])
    .filter((r) => r.status === "PLANNED" || r.status === "IN_PROGRESS")
    .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""))
    .slice(0, 3);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Welcome header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">
            {greeting}, {firstName}! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">{today}</p>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending Approvals"
          value={stats?.pending_leaves}
          icon={ClipboardList}
          colorClasses={{
            bg: "bg-amber-50",
            icon: "text-amber-500",
            value: "text-amber-700",
          }}
          loading={statsLoading}
        />
        <StatCard
          label="Out Today"
          value={stats?.approved_leaves_today}
          icon={UserX}
          colorClasses={{
            bg: "bg-rose-50",
            icon: "text-rose-500",
            value: "text-rose-700",
          }}
          loading={statsLoading}
        />
        <StatCard
          label="Ideas in Review"
          value={stats?.ideas_under_review}
          icon={Lightbulb}
          colorClasses={{
            bg: "bg-blue-50",
            icon: "text-blue-500",
            value: "text-blue-700",
          }}
          loading={statsLoading}
        />
        <StatCard
          label="Upcoming Releases"
          value={stats?.upcoming_releases}
          icon={Rocket}
          colorClasses={{
            bg: "bg-indigo-50",
            icon: "text-indigo-500",
            value: "text-indigo-700",
          }}
          loading={statsLoading}
        />
      </div>

      {/* ── Who's out + Quick actions row ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Who's Out — 60% */}
        <Card className="lg:col-span-3">
          <CardHeader
            title="Who's Out Today"
            action={
              <button
                onClick={() => navigate("/leave")}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="px-5 py-2">
            <WhoIsOut entries={whoIsOut ?? []} loading={whoIsOutLoading} />
          </div>
        </Card>

        {/* Quick Actions — 40% */}
        <Card className="lg:col-span-2">
          <CardHeader title="Quick Actions" />
          <div className="px-5 py-4 space-y-2.5">
            <QuickActionButton
              icon={CalendarDays}
              label="Request Leave"
              description="Submit a new leave request"
              colorClasses="bg-amber-50 border-amber-100 text-amber-800 hover:bg-amber-100 hover:border-amber-200"
              onClick={() => navigate("/leave")}
            />
            <QuickActionButton
              icon={Lightbulb}
              label="Submit an Idea"
              description="Share your innovation with the team"
              colorClasses="bg-blue-50 border-blue-100 text-blue-800 hover:bg-blue-100 hover:border-blue-200"
              onClick={() => navigate("/ideas")}
            />
            <QuickActionButton
              icon={Rocket}
              label="View Releases"
              description="Track upcoming product releases"
              colorClasses="bg-indigo-50 border-indigo-100 text-indigo-800 hover:bg-indigo-100 hover:border-indigo-200"
              onClick={() => navigate("/releases")}
            />
          </div>
        </Card>
      </div>

      {/* ── Recent ideas + Upcoming releases row ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Ideas */}
        <Card>
          <CardHeader
            title="Recent Ideas"
            action={
              <button
                onClick={() => navigate("/ideas")}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="px-5 py-2">
            {ideasLoading ? (
              <div className="divide-y divide-slate-50">
                <SkeletonListRow />
                <SkeletonListRow />
                <SkeletonListRow />
              </div>
            ) : recentIdeas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Lightbulb className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-500">No ideas yet.</p>
                <button
                  onClick={() => navigate("/ideas")}
                  className="mt-2 text-xs text-indigo-600 hover:underline"
                >
                  Be the first to submit one
                </button>
              </div>
            ) : (
              recentIdeas.map((idea) => <RecentIdeaRow key={idea.id} idea={idea} />)
            )}
          </div>
        </Card>

        {/* Upcoming Releases */}
        <Card>
          <CardHeader
            title="Upcoming Releases"
            action={
              <button
                onClick={() => navigate("/releases")}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="px-5 py-2">
            {releasesLoading ? (
              <div className="divide-y divide-slate-50">
                <SkeletonListRow />
                <SkeletonListRow />
                <SkeletonListRow />
              </div>
            ) : upcomingReleases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Rocket className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-500">No upcoming releases.</p>
                <button
                  onClick={() => navigate("/releases")}
                  className="mt-2 text-xs text-indigo-600 hover:underline"
                >
                  View release board
                </button>
              </div>
            ) : (
              upcomingReleases.map((release) => (
                <UpcomingReleaseRow key={release.id} release={release} />
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
