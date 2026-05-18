import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Trash2, Info, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "danger" | "warning" | "info" | "success";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void;
}

const VARIANT_CONFIG: Record<
  Variant,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    confirmBtn: string;
  }
> = {
  danger: {
    icon: Trash2,
    iconBg: "bg-rose-100 dark:bg-rose-950/60",
    iconColor: "text-rose-500 dark:text-rose-400",
    confirmBtn:
      "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/30 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100 dark:bg-amber-950/60",
    iconColor: "text-amber-500 dark:text-amber-400",
    confirmBtn:
      "bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/30 text-white",
  },
  info: {
    icon: Info,
    iconBg: "bg-indigo-100 dark:bg-indigo-950/60",
    iconColor: "text-indigo-500 dark:text-indigo-400",
    confirmBtn:
      "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/30 text-white",
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-emerald-100 dark:bg-emerald-950/60",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    confirmBtn:
      "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/30 text-white",
  },
};

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
}: ConfirmDialogProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Close button */}
          <Dialog.Close className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150">
            <X className="w-4 h-4" />
          </Dialog.Close>

          {/* Icon + text */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0", config.iconBg)}>
              <Icon className={cn("w-7 h-7", config.iconColor)} />
            </div>

            <div className="space-y-1.5">
              <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-white">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {description}
              </Dialog.Description>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Dialog.Close asChild>
              <button className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-150">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-150 focus:outline-none focus:ring-2",
                config.confirmBtn
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
