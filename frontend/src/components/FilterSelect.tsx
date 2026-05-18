import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  emoji?: string;
}

interface FilterSelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: FilterOption<T>[];
  icon?: React.ComponentType<{ className?: string }>;
  placeholder?: string;
  className?: string;
}

export default function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  icon: Icon,
  placeholder,
  className,
}: FilterSelectProps<T>) {
  const selected = options.find((o) => o.value === value);

  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <Select.Trigger
        className={cn(
          "inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700",
          "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300",
          "hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50",
          "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400",
          "transition-colors duration-150 whitespace-nowrap",
          className
        )}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />}
        {selected?.emoji && <span className="text-base leading-none">{selected.emoji}</span>}
        <Select.Value placeholder={placeholder}>{selected?.label ?? placeholder}</Select.Value>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0" />
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[160px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95"
        >
          <Select.Viewport className="p-1">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer outline-none select-none",
                  "text-slate-700 dark:text-slate-300",
                  "data-[highlighted]:bg-indigo-50 dark:data-[highlighted]:bg-indigo-950/50",
                  "data-[highlighted]:text-indigo-700 dark:data-[highlighted]:text-indigo-300",
                  "data-[state=checked]:font-semibold"
                )}
              >
                <Select.ItemIndicator>
                  <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </Select.ItemIndicator>
                {opt.emoji && <span className="leading-none">{opt.emoji}</span>}
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
