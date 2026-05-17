import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import IdeaCard from "@/components/Ideas/IdeaCard";
import type { Idea, IdeaStatus } from "@/types";

// ─── Column configuration ─────────────────────────────────────────────────────

interface ColumnConfig {
  status: IdeaStatus;
  label: string;
  /** Tailwind bg class for the top accent bar */
  accentBar: string;
  headerText: string;
  countPill: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    status: "SUBMITTED",
    label: "Submitted",
    accentBar: "bg-sky-400",
    headerText: "text-sky-700 dark:text-sky-400",
    countPill: "bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300",
  },
  {
    status: "UNDER_REVIEW",
    label: "Under Review",
    accentBar: "bg-indigo-500",
    headerText: "text-indigo-700 dark:text-indigo-400",
    countPill: "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300",
  },
  {
    status: "APPROVED",
    label: "Approved",
    accentBar: "bg-emerald-500",
    headerText: "text-emerald-700 dark:text-emerald-400",
    countPill: "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300",
  },
  {
    status: "REJECTED",
    label: "Rejected",
    accentBar: "bg-rose-400",
    headerText: "text-rose-700 dark:text-rose-400",
    countPill: "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300",
  },
  {
    status: "IMPLEMENTED",
    label: "Implemented",
    accentBar: "bg-purple-500",
    headerText: "text-purple-700 dark:text-purple-400",
    countPill: "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ideas: Idea[];
  currentUserId: string;
  currentUserRole: "EMPLOYEE" | "MANAGER" | "ADMIN";
  onVote: (id: string) => void;
  isVotePending?: boolean;
  onStatusChange: (id: string, status: IdeaStatus) => void;
  onCardClick: (idea: Idea) => void;
  statusFilter?: IdeaStatus | "ALL";
}

// ─── Sortable card wrapper ────────────────────────────────────────────────────

interface SortableIdeaCardProps {
  idea: Idea;
  currentUserId: string;
  currentUserRole: "EMPLOYEE" | "MANAGER" | "ADMIN";
  canDrag: boolean;
  onVote: (id: string) => void;
  isVotePending?: boolean;
  onStatusChange: (id: string, status: IdeaStatus) => void;
  onClick: (idea: Idea) => void;
}

function SortableIdeaCard({
  idea,
  currentUserId,
  currentUserRole,
  canDrag,
  onVote,
  isVotePending,
  onStatusChange,
  onClick,
}: SortableIdeaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: idea.id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      className={cn(
        "touch-none w-80 flex-shrink-0",
        isDragging ? "opacity-40" : "opacity-100",
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      )}
    >
      <IdeaCard
        idea={idea}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onVote={onVote}
        isVotePending={isVotePending}
        onStatusChange={onStatusChange}
        onClick={onClick}
      />
    </div>
  );
}

// ─── Droppable horizontal swimlane ────────────────────────────────────────────

interface ColumnProps {
  config: ColumnConfig;
  ideas: Idea[];
  currentUserId: string;
  currentUserRole: "EMPLOYEE" | "MANAGER" | "ADMIN";
  canDrag: boolean;
  onVote: (id: string) => void;
  isVotePending?: boolean;
  onStatusChange: (id: string, status: IdeaStatus) => void;
  onCardClick: (idea: Idea) => void;
}

function KanbanRow({
  config,
  ideas,
  currentUserId,
  currentUserRole,
  canDrag,
  onVote,
  isVotePending,
  onStatusChange,
  onCardClick,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: config.status });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-4">
      {/* Row header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 relative overflow-hidden",
          isOver && canDrag ? "ring-2 ring-indigo-400 bg-slate-50 dark:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/50"
        )}
      >
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", config.accentBar)} />
        <span className={cn("text-sm font-semibold pl-2", config.headerText)}>
          {config.label}
        </span>
        <span
          className={cn(
            "text-xs font-bold px-2.5 py-0.5 rounded-full",
            config.countPill
          )}
        >
          {ideas.length}
        </span>
      </div>

      {/* Cards in horizontal swimlane */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex items-stretch gap-4 overflow-x-auto pb-2 min-h-[160px] scrollbar-hide rounded-xl p-2 transition-colors duration-150",
          isOver && canDrag ? "bg-indigo-50/30 dark:bg-indigo-950/20 border-2 border-dashed border-indigo-200 dark:border-indigo-800" : "bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80"
        )}
      >
        <SortableContext
          items={ideas.map((i) => i.id)}
          strategy={horizontalListSortingStrategy}
        >
          {ideas.map((idea) => (
            <SortableIdeaCard
              key={idea.id}
              idea={idea}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              canDrag={canDrag}
              onVote={onVote}
              isVotePending={isVotePending}
              onStatusChange={onStatusChange}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {ideas.length === 0 && (
          <div
            className={cn(
              "w-full flex items-center justify-center py-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800",
              "text-xs text-slate-400 font-medium",
              isOver && canDrag ? "border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400" : ""
            )}
          >
            {isOver && canDrag ? "Drop here" : "No ideas in this status"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main KanbanBoard ─────────────────────────────────────────────────────────

export default function KanbanBoard({
  ideas,
  currentUserId,
  currentUserRole,
  onVote,
  isVotePending,
  onStatusChange,
  onCardClick,
  statusFilter,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const canDrag = currentUserRole === "MANAGER" || currentUserRole === "ADMIN";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeIdea = activeId ? ideas.find((i) => i.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !canDrag) return;

    const draggedId = String(active.id);
    const overId = String(over.id);

    // overId is either a column status or another card id
    const targetStatus = COLUMNS.find((c) => c.status === overId)?.status;

    if (targetStatus) {
      // Dropped directly onto a column
      const draggedIdea = ideas.find((i) => i.id === draggedId);
      if (draggedIdea && draggedIdea.status !== targetStatus) {
        onStatusChange(draggedId, targetStatus);
      }
    } else {
      // Dropped onto another card — find which column that card lives in
      const overIdea = ideas.find((i) => i.id === overId);
      if (overIdea) {
        const draggedIdea = ideas.find((i) => i.id === draggedId);
        if (draggedIdea && draggedIdea.status !== overIdea.status) {
          onStatusChange(draggedId, overIdea.status);
        }
      }
    }
  }

  // Group ideas by status
  const byStatus = (status: IdeaStatus) =>
    ideas.filter((i) => i.status === status);

  const displayedColumns = useMemo(() => {
    if (!statusFilter || statusFilter === "ALL") return COLUMNS;
    return COLUMNS.filter((c) => c.status === statusFilter);
  }, [statusFilter]);

  return (
    <DndContext
      sensors={canDrag ? sensors : []}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Vertically stacked horizontal swimlanes */}
      <div className="space-y-6 pb-4">
        {displayedColumns.map((col) => (
          <KanbanRow
            key={col.status}
            config={col}
            ideas={byStatus(col.status)}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            canDrag={canDrag}
            onVote={onVote}
            isVotePending={isVotePending}
            onStatusChange={onStatusChange}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      {/* Drag overlay — semi-transparent copy of active card */}
      <DragOverlay dropAnimation={null}>
        {activeIdea ? (
          <div className="rotate-2 opacity-90 pointer-events-none w-80">
            <IdeaCard
              idea={activeIdea}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onVote={() => undefined}
              onClick={() => undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
