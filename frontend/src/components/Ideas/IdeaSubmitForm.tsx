import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { X, ChevronDown, Check, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateIdea } from "@/hooks/useIdeas";
import type { IdeaCategory } from "@/types";

// ─── Category options ─────────────────────────────────────────────────────────

interface CategoryOption {
  value: IdeaCategory;
  label: string;
  emoji: string;
}

const CATEGORIES: CategoryOption[] = [
  { value: "PRODUCT", label: "Product", emoji: "📦" },
  { value: "PROCESS", label: "Process", emoji: "🔄" },
  { value: "TECH", label: "Tech", emoji: "💻" },
  { value: "CULTURE", label: "Culture", emoji: "🌱" },
  { value: "OTHER", label: "Other", emoji: "🌀" },
];

const TITLE_MAX = 256;
const DESC_MIN = 50;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IdeaSubmitForm({ open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IdeaCategory | "">("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ title: false, category: false, description: false });

  const { mutateAsync, isPending } = useCreateIdea();

  function resetForm() {
    setTitle("");
    setCategory("");
    setDescription("");
    setSubmitError(null);
    setTouched({ title: false, category: false, description: false });
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  // Derived validation
  const titleError = !title.trim() ? "Title is required" : title.length > TITLE_MAX ? `Max ${TITLE_MAX} characters` : null;
  const categoryError = !category ? "Please select a category" : null;
  const descError = description.trim().length < DESC_MIN
    ? `Description must be at least ${DESC_MIN} characters (${description.trim().length}/${DESC_MIN})`
    : null;
  const isValid = !titleError && !categoryError && !descError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ title: true, category: true, description: true });
    if (!isValid || !category) return;

    setSubmitError(null);
    try {
      await mutateAsync({ title: title.trim(), description: description.trim(), category });
      resetForm();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to submit idea. Please try again.";
      setSubmitError(msg);
    }
  }

  const selectedCat = CATEGORIES.find((c) => c.value === category);

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content */}
        <Dialog.Content
          className={cn(
            "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-xl max-h-[90vh] overflow-y-auto",
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
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-900 leading-tight">
                  Submit New Idea
                </Dialog.Title>
                <p className="text-xs text-slate-400 mt-0.5">
                  Share your idea with the team
                </p>
              </div>
            </div>
            <Dialog.Close className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Title <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={title}
                  maxLength={TITLE_MAX}
                  placeholder="Give your idea a clear, compelling title..."
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, title: true }))}
                  className={cn(
                    "w-full text-sm border rounded-xl px-3.5 py-2.5 pr-16 text-slate-800 placeholder-slate-400 transition-colors duration-150",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400",
                    touched.title && titleError
                      ? "border-rose-300 bg-rose-50 focus:ring-rose-200 focus:border-rose-400"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                />
                <span
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium",
                    title.length > TITLE_MAX * 0.9 ? "text-rose-500" : "text-slate-400"
                  )}
                >
                  {title.length}/{TITLE_MAX}
                </span>
              </div>
              {touched.title && titleError && (
                <p className="text-xs text-rose-500">{titleError}</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Category <span className="text-rose-500">*</span>
              </label>
              <Select.Root
                value={category}
                onValueChange={(v) => {
                  setCategory(v as IdeaCategory);
                  setTouched((t) => ({ ...t, category: true }));
                }}
              >
                <Select.Trigger
                  className={cn(
                    "w-full flex items-center justify-between gap-2 text-sm border rounded-xl px-3.5 py-2.5 transition-colors duration-150",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400",
                    touched.category && categoryError
                      ? "border-rose-300 bg-rose-50 text-slate-500"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                  )}
                >
                  <Select.Value placeholder="Choose a category...">
                    {selectedCat ? (
                      <span className="flex items-center gap-2">
                        <span>{selectedCat.emoji}</span>
                        <span>{selectedCat.label}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Choose a category...</span>
                    )}
                  </Select.Value>
                  <Select.Icon>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                  <Select.Content
                    position="popper"
                    sideOffset={4}
                    className="z-[60] w-[--radix-select-trigger-width] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                  >
                    <Select.Viewport className="p-1">
                      {CATEGORIES.map((cat) => (
                        <Select.Item
                          key={cat.value}
                          value={cat.value}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 rounded-lg cursor-pointer outline-none",
                            "data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700",
                            "data-[state=checked]:font-medium"
                          )}
                        >
                          <span>{cat.emoji}</span>
                          <Select.ItemText>{cat.label}</Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <Check className="w-4 h-4 text-indigo-600" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
              {touched.category && categoryError && (
                <p className="text-xs text-rose-500">{categoryError}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Description <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  value={description}
                  placeholder="Describe your idea in detail. What problem does it solve? What's the expected impact?..."
                  rows={5}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, description: true }))}
                  className={cn(
                    "w-full text-sm border rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 resize-y transition-colors duration-150",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400",
                    "min-h-[120px]",
                    touched.description && descError
                      ? "border-rose-300 bg-rose-50 focus:ring-rose-200 focus:border-rose-400"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                />
              </div>
              <div className="flex items-center justify-between">
                {touched.description && descError ? (
                  <p className="text-xs text-rose-500">{descError}</p>
                ) : (
                  <span className="text-xs text-slate-400">
                    Minimum {DESC_MIN} characters
                  </span>
                )}
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    description.trim().length < DESC_MIN ? "text-slate-400" : "text-emerald-600"
                  )}
                >
                  {description.trim().length} chars
                </span>
              </div>
            </div>

            {/* API Error */}
            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-sm text-rose-600">{submitError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm",
                  isPending
                    ? "bg-indigo-400 text-white cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white"
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-4 h-4" />
                    Submit Idea
                  </>
                )}
              </button>
              <Dialog.Close
                type="button"
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors duration-150"
              >
                Cancel
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
