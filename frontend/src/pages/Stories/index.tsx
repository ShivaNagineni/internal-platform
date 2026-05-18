import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  Plus,
  Search,
  ExternalLink,
  Pencil,
  Trash2,
  Bug,
  BookOpen,
  CheckSquare,
  UserCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  Calendar,
  BarChart2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn, getInitials } from "@/lib/utils";
import type { Sprint, Story, StoryCreate, StoryUpdate, UserRole, WorkItemType } from "@/types";
import {
  useStories,
  useCreateStory,
  useUpdateStory,
  useUpdateStoryState,
  useDeleteStory,
  useMoveStoryToSprint,
  useSprints,
  useStoriesProjects,
  useStoriesStates,
} from "@/hooks/useStories";
import { useUsers, useCurrentUser } from "@/hooks/useUsers";
import ConfirmDialog from "@/components/ConfirmDialog";
import StoryFormModal from "@/components/Stories/StoryFormModal";

// ─── Constants & helpers ──────────────────────────────────────────────────────

const MANAGER_ROLES: UserRole[] = ["MANAGER", "ADMIN", "OWNER"];
const DONE_STATES = new Set(["Closed", "Resolved", "Done", "Completed"]);

const TYPE_CONFIG: Record<WorkItemType, { icon: React.ComponentType<{ className?: string }>; style: string }> = {
  "User Story": {
    icon: BookOpen,
    style: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  },
  Task: {
    icon: CheckSquare,
    style: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  Bug: {
    icon: Bug,
    style: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  },
};

const STATE_STYLES: Record<string, string> = {
  New: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  Active: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  "In Progress": "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Resolved: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Closed: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  Done: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
};

const PRIORITY_CONFIG: Record<number, { label: string; style: string }> = {
  1: { label: "Critical", style: "text-rose-600 dark:text-rose-400 font-semibold" },
  2: { label: "High", style: "text-orange-600 dark:text-orange-400 font-semibold" },
  3: { label: "Medium", style: "text-amber-600 dark:text-amber-400" },
  4: { label: "Low", style: "text-slate-500 dark:text-slate-400" },
};

// ─── Generic searchable select ───────────────────────────────────────────────

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  allLabel = "All",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLabel = value === "ALL" ? "" : (options.find((o) => o.value === value)?.label ?? "");
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideContainer = containerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideContainer && !insideDropdown) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openDropdown() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 200);
    const spaceRight = window.innerWidth - rect.left;
    const left = spaceRight >= dropdownWidth ? rect.left : rect.right - dropdownWidth;
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: Math.max(8, left),
      minWidth: dropdownWidth,
      maxWidth: 320,
      zIndex: 9999,
    });
    setOpen(true);
  }

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-indigo-400 min-w-[160px]">
        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <input
          value={open ? query : selectedLabel}
          onChange={(e) => { setQuery(e.target.value); if (!open) openDropdown(); }}
          onFocus={() => { if (!open) openDropdown(); }}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 text-sm min-w-0"
        />
        {value !== "ALL" ? (
          <button
            onClick={(e) => { e.stopPropagation(); select("ALL"); setQuery(""); }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        )}
      </div>

      {open && createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          <div
            onClick={() => select("ALL")}
            className={cn(
              "px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
              value === "ALL" ? "text-indigo-600 dark:text-indigo-400 font-semibold" : "text-slate-600 dark:text-slate-300"
            )}
          >
            {allLabel}
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No results for "{query}"</p>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.value}
                  onClick={() => select(o.value)}
                  className={cn(
                    "px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                    value === o.value
                      ? "text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/30"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className="truncate block">{o.label}</span>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Searchable user dropdown ─────────────────────────────────────────────────

function UserSearchDropdown({
  assignees,
  value,
  onChange,
}: {
  assignees: [string, string][];
  value: string;
  onChange: (email: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedName = value === "ALL" ? "" : (assignees.find(([e]) => e === value)?.[1] ?? "");

  const filtered = query.trim()
    ? assignees.filter(([, name]) => name.toLowerCase().includes(query.toLowerCase()))
    : assignees;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(email: string) {
    onChange(email);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-indigo-400 min-w-[180px]">
        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <input
          value={open ? query : selectedName}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Filter by member…"
          className="flex-1 bg-transparent outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 text-sm min-w-0"
        />
        {value !== "ALL" ? (
          <button
            onClick={(e) => { e.stopPropagation(); select("ALL"); setQuery(""); }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        )}
      </div>

      {open && (
        <div className="absolute z-[200] mt-1 right-0 min-w-[220px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          <div
            onClick={() => select("ALL")}
            className={cn(
              "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
              value === "ALL" ? "text-indigo-600 dark:text-indigo-400 font-semibold" : "text-slate-600 dark:text-slate-300"
            )}
          >
            <UserCircle className="w-4 h-4 text-slate-400" />
            All Members
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No members match "{query}"</p>
            ) : (
              filtered.map(([email, name]) => (
                <div
                  key={email}
                  onClick={() => select(email)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                    value === email ? "text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/30" : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[9px] font-bold">{getInitials(name)}</span>
                  </div>
                  <span className="truncate">{name}</span>
                  {value === email && <span className="ml-auto text-indigo-500 text-xs">✓</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type as WorkItemType] ?? TYPE_CONFIG["User Story"];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap", cfg.style)}>
      <Icon className="w-3 h-3" />
      {type}
    </span>
  );
}

function StateBadge({ state }: { state: string }) {
  const style = STATE_STYLES[state] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap", style)}>
      {state}
    </span>
  );
}


function StateSelect({
  story,
  statesMap,
  onStateChange,
}: {
  story: Story;
  statesMap: Record<string, string[]>;
  onStateChange: (id: number, state: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const style = STATE_STYLES[story.state] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  const typeStates = statesMap[story.work_item_type] ?? [story.state];

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const state = e.target.value;
    if (state === story.state) return;
    setPending(true);
    await onStateChange(story.id, state);
    setPending(false);
  }

  return (
    <select
      value={story.state}
      onChange={handleChange}
      disabled={pending}
      className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-opacity",
        style,
        pending && "opacity-50 cursor-wait"
      )}
    >
      {typeStates.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function ProjectBadge({ project }: { project: string }) {
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
      {project}
    </span>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "No dates set";
  if (start && end) {
    return `${new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return formatDate(start || end);
}

// ─── Sprint move select ───────────────────────────────────────────────────────

function SprintMoveSelect({
  story,
  sprints,
  currentSprintName,
  onMove,
}: {
  story: Story;
  sprints: Sprint[];
  currentSprintName?: string;
  onMove: (storyId: number, sprintPath: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projectSprints = sprints.filter((s) => s.project === story.project);
  const filtered = query.trim()
    ? projectSprints.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : projectSprints;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openDropdown() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const w = 220;
    const left = window.innerWidth - rect.left >= w ? rect.left : rect.right - w;
    setDropdownStyle({ position: "fixed", top: rect.bottom + 4, left: Math.max(8, left), width: w, zIndex: 9999 });
    setOpen(true);
  }

  async function handleSelect(sprint: Sprint) {
    if (sprint.name === currentSprintName) { setOpen(false); setQuery(""); return; }
    setOpen(false);
    setQuery("");
    setPending(true);
    await onMove(story.id, sprint.path);
    setPending(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => open ? (setOpen(false), setQuery("")) : openDropdown()}
        disabled={pending}
        title="Move to sprint"
        className={cn(
          "text-xs font-medium px-2 py-0.5 rounded-full border transition-opacity whitespace-nowrap",
          currentSprintName
            ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40 cursor-pointer"
            : "text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer",
          pending && "opacity-50 cursor-wait"
        )}
      >
        {pending ? "Moving…" : (currentSprintName ?? "No sprint")}
      </button>

      {open && createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Search className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sprints…"
                className="flex-1 bg-transparent text-xs outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No sprints match "{query}"</p>
            ) : (
              filtered.map((sprint) => (
                <div
                  key={sprint.id}
                  onClick={() => handleSelect(sprint)}
                  className={cn(
                    "px-3 py-2 cursor-pointer text-xs flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                    sprint.name === currentSprintName
                      ? "text-violet-600 dark:text-violet-400 font-semibold bg-violet-50 dark:bg-violet-950/30"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className="truncate">{sprint.name}</span>
                  {sprint.name === currentSprintName && (
                    <span className="text-[10px] text-violet-400 shrink-0">current</span>
                  )}
                  {sprint.time_frame === "current" && sprint.name !== currentSprintName && (
                    <span className="text-[10px] text-indigo-400 shrink-0">active</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Shared story table ───────────────────────────────────────────────────────

function StoryTable({
  stories,
  isManagerPlus,
  onEdit,
  onDelete,
  onStateChange,
  statesMap,
  compact = false,
  sprintMap,
  sprints,
  onMoveSprint,
}: {
  stories: Story[];
  isManagerPlus: boolean;
  onEdit: (s: Story) => void;
  onDelete: (s: Story) => void;
  onStateChange: (id: number, state: string) => void;
  statesMap: Record<string, string[]>;
  compact?: boolean;
  sprintMap?: Map<number, string>;
  sprints?: Sprint[];
  onMoveSprint?: (storyId: number, sprintPath: string) => Promise<void>;
}) {
  if (stories.length === 0) {
    return (
      <p className="text-center py-6 text-sm text-slate-400 dark:text-slate-500">
        No work items in this sprint.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5">Title</th>
            <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5">Project</th>
            <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5">Type</th>
            <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5">State</th>
            <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5">Assignee</th>
            <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5">Priority</th>
            {sprintMap && (
              <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5">Sprint</th>
            )}
            {!compact && (
              <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-3 py-2.5">Updated</th>
            )}
            {isManagerPlus && (
              <th className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-4 py-2.5">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {stories.map((story) => {
            const assigneeDisplay =
              story.assigned_to_platform_user?.display_name ?? story.assigned_to?.display_name ?? null;
            const priorityCfg = story.priority != null ? PRIORITY_CONFIG[story.priority] : null;

            return (
              <tr key={story.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                <td className="px-4 py-2.5 max-w-xs">
                  <div className="flex items-start gap-1.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight line-clamp-1">
                        {story.title}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">#{story.id}</p>
                    </div>
                    {story.url && (
                      <a
                        href={story.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0 text-slate-400 hover:text-indigo-500"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap"><ProjectBadge project={story.project} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap"><TypeBadge type={story.work_item_type} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <StateSelect story={story} statesMap={statesMap} onStateChange={onStateChange} />
                </td>
                <td className="px-3 py-2.5">
                  {assigneeDisplay ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[8px] font-semibold">{getInitials(assigneeDisplay)}</span>
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{assigneeDisplay}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                      <UserCircle className="w-3.5 h-3.5" />
                      <span className="text-xs">Unassigned</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {priorityCfg ? (
                    <span className={cn("text-xs", priorityCfg.style)}>{priorityCfg.label}</span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                  )}
                </td>
                {sprintMap && (
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {isManagerPlus && sprints && onMoveSprint ? (
                      <SprintMoveSelect
                        story={story}
                        sprints={sprints}
                        currentSprintName={sprintMap.get(story.id)}
                        onMove={onMoveSprint}
                      />
                    ) : sprintMap.get(story.id) ? (
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 rounded-full">
                        {sprintMap.get(story.id)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                )}
                {!compact && (
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(story.changed_date)}</span>
                  </td>
                )}
                {isManagerPlus && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(story)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(story)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sprint card ──────────────────────────────────────────────────────────────

function SprintCard({
  sprint,
  isManagerPlus,
  onEdit,
  onDelete,
  onStateChange,
  statesMap,
  defaultExpanded,
}: {
  sprint: Sprint;
  isManagerPlus: boolean;
  onEdit: (s: Story) => void;
  onDelete: (s: Story) => void;
  onStateChange: (id: number, state: string) => void;
  statesMap: Record<string, string[]>;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isCurrent = sprint.time_frame === "current";
  const { total, done_count, by_state, by_type } = sprint.stats;
  const progress = total > 0 ? Math.round((done_count / total) * 100) : 0;

  const stateEntries = Object.entries(by_state).sort((a, b) => b[1] - a[1]);
  const typeEntries = Object.entries(by_type).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className={cn(
        "rounded-2xl border shadow-sm overflow-hidden transition-all",
        isCurrent
          ? "border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900"
          : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
      )}
    >
      {/* Sprint header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between px-5 py-4 text-left transition-colors",
          isCurrent
            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600"
            : "bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isCurrent ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest">Current Sprint</span>
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Past Sprint</span>
          )}
          <span className={cn("text-base font-bold truncate", isCurrent ? "text-white" : "text-slate-800 dark:text-slate-200")}>
            {sprint.name}
          </span>
          {sprint.project && (
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
              isCurrent
                ? "bg-white/20 text-white"
                : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
            )}>
              {sprint.project}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Date range */}
          <div className={cn("hidden sm:flex items-center gap-1.5 text-xs", isCurrent ? "text-white/80" : "text-slate-500 dark:text-slate-400")}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDateRange(sprint.start_date, sprint.finish_date)}</span>
          </div>

          {/* Item count */}
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            isCurrent
              ? "bg-white/20 text-white"
              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          )}>
            {total} items
          </span>

          {/* Progress */}
          {total > 0 && (
            <span className={cn(
              "text-xs font-bold",
              isCurrent ? "text-white" : (progress === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300")
            )}>
              {progress}% done
            </span>
          )}

          {/* Expand icon */}
          {expanded
            ? <ChevronDown className={cn("w-4 h-4", isCurrent ? "text-white/80" : "text-slate-400")} />
            : <ChevronRight className={cn("w-4 h-4", isCurrent ? "text-white/80" : "text-slate-400")} />
          }
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* Stats row */}
          {total > 0 && (
            <div className="px-5 py-3 flex flex-wrap gap-4 items-center">
              {/* Progress bar */}
              <div className="flex items-center gap-2 min-w-[160px]">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-9 text-right">
                  {progress}%
                </span>
              </div>

              {/* State breakdown */}
              <div className="flex flex-wrap gap-1.5">
                {stateEntries.map(([state, count]) => (
                  <span key={state} className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                    STATE_STYLES[state] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  )}>
                    {state}: {count}
                  </span>
                ))}
              </div>

              {/* Type breakdown */}
              <div className="flex flex-wrap gap-1.5">
                {typeEntries.map(([type, count]) => {
                  const cfg = TYPE_CONFIG[type as WorkItemType];
                  return (
                    <span key={type} className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      cfg?.style ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    )}>
                      {type}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Story table */}
          <StoryTable
            stories={sprint.stories}
            isManagerPlus={isManagerPlus}
            onEdit={onEdit}
            onDelete={onDelete}
            onStateChange={onStateChange}
            statesMap={statesMap}
            compact
          />
        </div>
      )}
    </div>
  );
}

// ─── Sprints view ─────────────────────────────────────────────────────────────

function SprintsView({
  isManagerPlus,
  onEdit,
  onDelete,
  onStateChange,
  statesMap,
}: {
  isManagerPlus: boolean;
  onEdit: (s: Story) => void;
  onDelete: (s: Story) => void;
  onStateChange: (id: number, state: string) => void;
  statesMap: Record<string, string[]>;
}) {
  const { data: sprints = [], isLoading, error } = useSprints();
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");

  const allAssignees = Array.from(
    new Map(
      sprints
        .flatMap((s) => s.stories)
        .filter((s) => s.assigned_to?.unique_name)
        .map((s) => [
          s.assigned_to!.unique_name,
          s.assigned_to_platform_user?.display_name ?? s.assigned_to!.display_name,
        ])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filteredSprints = sprints.map((sprint) => ({
    ...sprint,
    stories:
      assigneeFilter === "ALL"
        ? sprint.stories
        : sprint.stories.filter(
            (s) => s.assigned_to?.unique_name === assigneeFilter
          ),
  }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-sm text-rose-500 font-medium">Could not load sprints from Azure DevOps.</p>
        <p className="text-xs text-slate-400">Check your AZURE_DEVOPS_ORG and AZURE_DEVOPS_PROJECT configuration.</p>
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
        No sprints found in this project.
      </div>
    );
  }

  const current = filteredSprints.filter((s) => s.time_frame === "current");
  const past = filteredSprints.filter((s) => s.time_frame === "past");

  return (
    <div className="space-y-4">
      {/* Assignee filter */}
      {allAssignees.length > 0 && (
        <UserSearchDropdown
          assignees={allAssignees}
          value={assigneeFilter}
          onChange={setAssigneeFilter}
        />
      )}

      {current.map((sprint) => (
        <SprintCard
          key={sprint.id}
          sprint={sprint}
          isManagerPlus={isManagerPlus}
          onEdit={onEdit}
          onDelete={onDelete}
          onStateChange={onStateChange}
          statesMap={statesMap}
          defaultExpanded
        />
      ))}

      {past.length > 0 && (
        <>
          {current.length > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Previous Sprints</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
          )}
          {past.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              isManagerPlus={isManagerPlus}
              onEdit={onEdit}
              onDelete={onDelete}
              onStateChange={onStateChange}
              statesMap={statesMap}
              defaultExpanded={false}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── All items view ───────────────────────────────────────────────────────────

function AllItemsView({
  isManagerPlus,
  onEdit,
  onDelete,
  onStateChange,
  statesMap,
  onMoveSprint,
}: {
  isManagerPlus: boolean;
  onEdit: (s: Story) => void;
  onDelete: (s: Story) => void;
  onStateChange: (id: number, state: string) => void;
  statesMap: Record<string, string[]>;
  onMoveSprint: (storyId: number, sprintPath: string) => Promise<void>;
}) {
  const { data: stories = [], isLoading, error } = useStories();
  const { data: sprints = [] } = useSprints();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | WorkItemType>("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [sprintFilter, setSprintFilter] = useState("ALL");

  // Build a map of story id → sprint name from sprint data
  const storySprintMap = new Map<number, string>();
  for (const sprint of sprints) {
    for (const story of sprint.stories) {
      storySprintMap.set(story.id, sprint.name);
    }
  }

  const allProjects = Array.from(new Set(stories.map((s) => s.project))).sort();
  const allStates = Array.from(new Set(stories.map((s) => s.state))).sort();
  const allSprints = Array.from(
    new Map(sprints.map((sp) => [sp.id, sp.name])).values()
  );
  const allAssignees = Array.from(
    new Map(
      stories
        .filter((s) => s.assigned_to?.unique_name)
        .map((s) => [
          s.assigned_to!.unique_name,
          s.assigned_to_platform_user?.display_name ?? s.assigned_to!.display_name,
        ])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const byType = (t: WorkItemType) => stories.filter((s) => s.work_item_type === t).length;

  const filtered = stories.filter((s) => {
    if (projectFilter !== "ALL" && s.project !== projectFilter) return false;
    if (typeFilter !== "ALL" && s.work_item_type !== typeFilter) return false;
    if (stateFilter !== "ALL" && s.state !== stateFilter) return false;
    if (assigneeFilter !== "ALL" && s.assigned_to?.unique_name !== assigneeFilter) return false;
    if (sprintFilter !== "ALL" && storySprintMap.get(s.id) !== sprintFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const assigneeName =
        s.assigned_to_platform_user?.display_name ?? s.assigned_to?.display_name ?? "";
      return s.title.toLowerCase().includes(q) || assigneeName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Stats */}
      {isManagerPlus && stories.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <StatChip label="User Stories" value={byType("User Story")} color="indigo" />
          <StatChip label="Tasks" value={byType("Task")} color="emerald" />
          <StatChip label="Bugs" value={byType("Bug")} color="rose" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isManagerPlus ? "Search by title or assignee…" : "Search by title..."}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {allProjects.length > 1 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="ALL">All Projects</option>
            {allProjects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="ALL">All Types</option>
          <option value="User Story">User Story</option>
          <option value="Task">Task</option>
          <option value="Bug">Bug</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="ALL">All States</option>
          {allStates.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {allSprints.length > 0 && (
          <SearchableSelect
            options={allSprints.map((name) => ({ value: name, label: name }))}
            value={sprintFilter}
            onChange={setSprintFilter}
            placeholder="Filter by sprint…"
            allLabel="All Sprints"
          />
        )}
        {isManagerPlus && allAssignees.length > 0 && (
          <UserSearchDropdown
            assignees={allAssignees}
            value={assigneeFilter}
            onChange={setAssigneeFilter}
          />
        )}
        {(search || projectFilter !== "ALL" || typeFilter !== "ALL" || stateFilter !== "ALL" || (isManagerPlus && assigneeFilter !== "ALL") || sprintFilter !== "ALL") && (
          <span className="px-2 py-1 rounded-md bg-indigo-500 text-white text-sm">{filtered.length} items</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm text-rose-500 dark:text-rose-400 font-medium">
              Could not load stories from Azure DevOps.
            </p>
            <p className="text-xs text-slate-400">
              Check that AZURE_DEVOPS_ORG and AZURE_DEVOPS_PROJECT are configured.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
            {stories.length === 0
              ? isManagerPlus
                ? "No work items found. Create the first one."
                : "No work items are assigned to you."
              : "No items match the current filters."}
          </div>
        ) : (
          <StoryTable
            stories={filtered}
            isManagerPlus={isManagerPlus}
            onEdit={onEdit}
            onDelete={onDelete}
            onStateChange={onStateChange}
            statesMap={statesMap}
            sprintMap={storySprintMap.size > 0 ? storySprintMap : undefined}
            sprints={sprints}
            onMoveSprint={onMoveSprint}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "items" | "sprints";

export default function StoriesPage() {
  const { data: users = [] } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const { data: projects = [] } = useStoriesProjects();
  const createStory = useCreateStory();
  const updateStory = useUpdateStory();
  const updateStoryState = useUpdateStoryState();
  const deleteStory = useDeleteStory();
  const qc = useQueryClient();

  const { data: statesMap = {} } = useStoriesStates();
  const moveStoryToSprint = useMoveStoryToSprint();

  async function handleStateChange(id: number, state: string) {
    await updateStoryState.mutateAsync({ id, state });
  }

  async function handleMoveSprint(id: number, sprintPath: string) {
    await moveStoryToSprint.mutateAsync({ id, sprintPath });
  }

  const isManagerPlus = currentUser ? MANAGER_ROLES.includes(currentUser.role) : false;

  const [activeTab, setActiveTab] = useState<Tab>(isManagerPlus ? "sprints" : "items");
  const [formOpen, setFormOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    await qc.invalidateQueries({ queryKey: ["stories"] });
    setSyncing(false);
  }

  async function handleFormSubmit(data: StoryCreate | StoryUpdate) {
    if (editingStory) {
      await updateStory.mutateAsync({ id: editingStory.id, payload: data as StoryUpdate });
    } else {
      await createStory.mutateAsync(data as StoryCreate);
    }
  }

  function openEdit(story: Story) {
    setEditingStory(story);
    setFormOpen(true);
  }

  function openCreate() {
    setEditingStory(null);
    setFormOpen(true);
  }

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    ...(isManagerPlus ? [{ key: "sprints" as Tab, label: "Sprints", icon: Zap }] : []),
    { key: "items", label: isManagerPlus ? "All Work Items" : "My Work Items", icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Azure Stories
            <ClipboardList className="w-5 h-5 text-indigo-500" />
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isManagerPlus ? "Manage work items and sprints." : "Your assigned work items and sprint progress."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sync with Azure DevOps"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            Sync
          </button>
          {isManagerPlus && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Work Item
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === key
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "sprints" ? (
        <SprintsView
          isManagerPlus={isManagerPlus}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          onStateChange={handleStateChange}
          statesMap={statesMap}
        />
      ) : (
        <AllItemsView
          isManagerPlus={isManagerPlus}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          onStateChange={handleStateChange}
          statesMap={statesMap}
          onMoveSprint={handleMoveSprint}
        />
      )}

      {/* Create / Edit modal */}
      <StoryFormModal
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingStory(null); }}
        users={users}
        projects={projects}
        story={editingStory}
        onSubmit={handleFormSubmit}
        isLoading={createStory.isPending || updateStory.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Delete Work Item"
        description={`Permanently delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) deleteStory.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: "indigo" | "emerald" | "rose" }) {
  const styles = {
    indigo: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    rose: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  };
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium", styles[color])}>
      <span className="font-bold text-base">{value}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}

