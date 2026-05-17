import { useState } from "react";
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
  verticalListSortingStrategy,
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
    headerText: "text-sky-700",
    countPill: "bg-sky-100 text-sky-700",
  },
  {
    status: "UNDER_REVIEW",
    label: "Under Review",
    accentBar: "bg-indigo-500",
    headerText: "text-indigo-700",
    countPill: "bg-indigo-100 text-indigo-700",
  },
  {
    status: "APPROVED",
    label: "Approved",
    accentBar: "bg-emerald-500",
    headerText: "text-emerald-700",
    countPill: "bg-emerald-100 text-emerald-700",
  },
  {
    status: "REJECTED",
    label: "Rejected",
    accentBar: "bg-rose-400",
    headerText: "text-rose-700",
    countPill: "bg-rose-100 text-rose-700",
  },
  {
    status: "IMPLEMENTED",
    label: "Implemented",
    accentBar: "bg-purple-500",
    headerText: "text-purple-700",
    countPill: "bg-purple-100 text-purple-700",
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
        "touch-none",
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

// ─── Droppable column ─────────────────────────────────────────────────────────

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

function KanbanColumn({
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
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="bg-white rounded-t-xl border border-slate-200 overflow-hidden">
        {/* Colored accent bar at top — uses a static bg class stored in config */}
        <div className={cn("h-1 w-full", config.accentBar)} />
        <div className="px-3.5 py-3 flex items-center justify-between">
          <h3 className={cn("text-sm font-semibold", config.headerText)}>
            {config.label}
          </h3>
          <span
            className={cn(
              "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold",
              config.countPill
            )}
          >
            {ideas.length}
          </span>
        </div>
      </div>

      {/* Drop zone / card list */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-b-xl bg-slate-50 border border-t-0 border-slate-200 p-2.5 space-y-2.5 overflow-y-auto",
          "min-h-[200px] max-h-[calc(100vh-260px)]",
          "transition-colors duration-150",
          isOver && canDrag ? "bg-slate-100 border-slate-300" : ""
        )}
      >
        <SortableContext
          items={ideas.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
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
              "flex items-center justify-center h-24 rounded-lg border-2 border-dashed border-slate-200",
              "text-xs text-slate-400 font-medium",
              isOver && canDrag ? "border-slate-400 bg-white" : ""
            )}
          >
            {isOver && canDrag ? "Drop here" : "No ideas"}
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

  return (
    <DndContext
      sensors={canDrag ? sensors : []}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Horizontally scrollable board */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
        {COLUMNS.map((col) => (
          <KanbanColumn
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
          <div className="rotate-2 opacity-90 pointer-events-none w-72">
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
