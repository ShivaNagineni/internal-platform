import { cn } from "@/lib/utils";

type BadgeSize = "sm" | "md";

interface StatusBadgeProps {
  status: string;
  size?: BadgeSize;
}

interface BadgeStyle {
  container: string;
  dot: string;
}

const STATUS_STYLES: Record<string, BadgeStyle> = {
  PENDING: {
    container: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  APPROVED: {
    container: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  RELEASED: {
    container: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  IMPLEMENTED: {
    container: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    container: "bg-rose-100 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  CANCELLED: {
    container: "bg-rose-100 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  UNDER_REVIEW: {
    container: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  IN_PROGRESS: {
    container: "bg-indigo-100 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  STAGING: {
    container: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  PLANNED: {
    container: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  SUBMITTED: {
    container: "bg-sky-100 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
  },
};

const FALLBACK_STYLE: BadgeStyle = {
  container: "bg-slate-100 text-slate-700 border-slate-200",
  dot: "bg-slate-400",
};

function toDisplayLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const normalizedKey = status.toUpperCase().replace(/\s+/g, "_");
  const style = STATUS_STYLES[normalizedKey] ?? FALLBACK_STYLE;
  const label = toDisplayLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border font-medium rounded-full leading-none whitespace-nowrap flex-shrink-0",
        style.container,
        size === "sm"
          ? "px-2 py-0.5 text-[10px]"
          : "px-2.5 py-1 text-xs"
      )}
    >
      <span
        className={cn(
          "rounded-full flex-shrink-0",
          style.dot,
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"
        )}
      />
      {label}
    </span>
  );
}
