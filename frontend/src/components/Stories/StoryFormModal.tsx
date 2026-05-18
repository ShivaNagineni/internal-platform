import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2 } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { Sprint, Story, StoryCreate, StoryUpdate, User, WorkItemType } from "@/types";

const WORK_ITEM_TYPES: WorkItemType[] = ["User Story", "Task", "Bug"];

const PRIORITY_LABELS: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };

const TYPE_COLORS: Record<WorkItemType, string> = {
  "User Story": "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300",
  Task: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  Bug: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
};

interface StoryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  projects: string[];
  sprints?: Sprint[];
  story?: Story | null;
  onSubmit: (data: StoryCreate | StoryUpdate) => Promise<void>;
  isLoading: boolean;
  isManagerPlus?: boolean;
  currentUserEmail?: string;
}

export default function StoryFormModal({
  open,
  onOpenChange,
  users,
  projects,
  sprints = [],
  story,
  onSubmit,
  isLoading,
  isManagerPlus = true,
  currentUserEmail,
}: StoryFormModalProps) {
  const isEdit = Boolean(story);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState(projects[0] ?? "");
  const [workItemType, setWorkItemType] = useState<WorkItemType>("User Story");
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [sprintPath, setSprintPath] = useState("");

  useEffect(() => {
    if (open) {
      if (story) {
        setTitle(story.title);
        setDescription(story.description ?? "");
        setProject(story.project);
        setWorkItemType(story.work_item_type as WorkItemType);
        setAssigneeEmail(story.assigned_to?.unique_name ?? "");
        setPriority(story.priority?.toString() ?? "");
      } else {
        setTitle("");
        setDescription("");
        setProject(projects[0] ?? "");
        setWorkItemType("User Story");
        setAssigneeEmail("");
        setPriority("");
        setSprintPath("");
      }
    }
  }, [open, story, projects]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEdit && story) {
      const payload: StoryUpdate = {};
      if (title !== story.title) payload.title = title;
      if (description !== (story.description ?? "")) payload.description = description;
      if (assigneeEmail !== (story.assigned_to?.unique_name ?? "")) {
        if (assigneeEmail) payload.assigned_to_email = assigneeEmail;
        else payload.clear_assignee = true;
      }
      if (priority) payload.priority = Number(priority);
      await onSubmit(payload);
    } else {
      const payload: StoryCreate = {
        title: title.trim(),
        project,
        work_item_type: workItemType,
      };
      if (description.trim()) payload.description = description.trim();
      if (assigneeEmail) payload.assigned_to_email = assigneeEmail;
      if (priority) payload.priority = Number(priority);
      if (sprintPath) payload.sprint_path = sprintPath;
      await onSubmit(payload);
    }

    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-white">
              {isEdit ? "Edit Work Item" : "New Work Item"}
            </Dialog.Title>
            <Dialog.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Work item title…"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Project + Type row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Project — disabled when editing */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Project <span className="text-rose-500">*</span>
                </label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  disabled={isEdit}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                >
                  {projects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Type — disabled when editing */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Type
                </label>
                <select
                  value={workItemType}
                  onChange={(e) => setWorkItemType(e.target.value as WorkItemType)}
                  disabled={isEdit}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                >
                  {WORK_ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {!isEdit && (
                  <span className={cn("inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full", TYPE_COLORS[workItemType])}>
                    {workItemType}
                  </span>
                )}
              </div>
            </div>

            {/* Priority + Assignee row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— None —</option>
                  {Object.entries(PRIORITY_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Assign To
                </label>
                {isManagerPlus ? (
                  <select
                    value={assigneeEmail}
                    onChange={(e) => setAssigneeEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">— Unassigned —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.display_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[9px] font-semibold">
                        {getInitials(users.find((u) => u.email === currentUserEmail)?.display_name ?? currentUserEmail ?? "")}
                      </span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300">
                      {users.find((u) => u.email === currentUserEmail)?.display_name ?? currentUserEmail ?? "You"}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400">auto-assigned</span>
                  </div>
                )}
              </div>
            </div>

            {isManagerPlus && assigneeEmail && (
              <div className="flex items-center gap-2 -mt-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[9px] font-semibold">
                    {getInitials(users.find((u) => u.email === assigneeEmail)?.display_name ?? assigneeEmail)}
                  </span>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {users.find((u) => u.email === assigneeEmail)?.display_name ?? assigneeEmail}
                </span>
              </div>
            )}

            {/* Sprint — only shown when creating and sprints are available */}
            {!isEdit && sprints.filter(s => s.project === project && s.time_frame !== "past").length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Sprint
                </label>
                <select
                  value={sprintPath}
                  onChange={(e) => setSprintPath(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— Backlog (no sprint) —</option>
                  {sprints
                    .filter(s => s.project === project && s.time_frame !== "past")
                    .map(s => (
                      <option key={s.id} value={s.path}>
                        {s.name}{s.time_frame === "current" ? " (current)" : ""}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description…"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isLoading || !title.trim() || !project}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Create"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
