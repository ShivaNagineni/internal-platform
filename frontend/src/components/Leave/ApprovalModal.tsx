import { useState, useId } from "react";
import type { FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateLeave } from "@/hooks/useLeave";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approve" | "reject";
  leaveId: string;
  onSuccess: () => void;
}

export default function ApprovalModal({
  open,
  onOpenChange,
  action,
  leaveId,
  onSuccess,
}: Props) {
  const formId = useId();
  const { mutate, isPending } = useUpdateLeave();

  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isApprove = action === "approve";

  const config = isApprove
    ? {
        title: "Approve Leave Request",
        description: "You are about to approve this leave request.",
        icon: CheckCircle2,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        buttonBg: "bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200 focus:ring-emerald-400",
        buttonLabel: "Approve Request",
        newStatus: "APPROVED" as const,
        commentLabel: "Add a comment (optional)",
        commentRequired: false,
      }
    : {
        title: "Reject Leave Request",
        description: "You are about to reject this leave request. A reason is required.",
        icon: XCircle,
        iconBg: "bg-rose-100",
        iconColor: "text-rose-600",
        buttonBg: "bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200 focus:ring-rose-400",
        buttonLabel: "Reject Request",
        newStatus: "REJECTED" as const,
        commentLabel: "Reason for rejection",
        commentRequired: true,
      };

  const StatusIcon = config.icon;

  function handleClose(next: boolean) {
    if (!next) {
      setComment("");
      setCommentError("");
      setErrorMessage("");
    }
    onOpenChange(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (config.commentRequired && comment.trim().length < 5) {
      setCommentError("Please provide a reason (at least 5 characters).");
      return;
    }
    setCommentError("");

    mutate(
      {
        id: leaveId,
        payload: {
          status: config.newStatus,
          ...(comment.trim() ? { approver_comment: comment.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          handleClose(false);
          onSuccess();
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Action failed. Please try again.";
          setErrorMessage(message);
        },
      },
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border dark:border-slate-800",
                  config.iconBg === "bg-emerald-100" ? "bg-emerald-100 dark:bg-emerald-950/80" : "bg-rose-100 dark:bg-rose-950/80",
                )}
              >
                <StatusIcon className={cn("w-5 h-5", config.iconColor === "text-emerald-600" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")} />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-white">
                  {config.title}
                </Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {config.description}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form id={`${formId}-form`} onSubmit={handleSubmit} noValidate>
            <div className="px-6 py-5 space-y-4">
              {/* Comment / Reason field */}
              <div>
                <label
                  htmlFor={`${formId}-comment`}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  {config.commentLabel}
                  {config.commentRequired && (
                    <span className="text-rose-500 ml-0.5">*</span>
                  )}
                </label>
                <textarea
                  id={`${formId}-comment`}
                  rows={3}
                  placeholder={
                    config.commentRequired
                      ? "Provide a reason for rejection…"
                      : "Add an optional note for the employee…"
                  }
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (commentError && e.target.value.trim().length >= 5) {
                      setCommentError("");
                    }
                  }}
                  className={cn(
                    "w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow duration-150",
                    commentError ? "border-rose-400 ring-1 ring-rose-300" : "border-slate-200 dark:border-slate-700",
                  )}
                />
                {commentError && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {commentError}
                  </p>
                )}
              </div>

              {/* API Error */}
              {errorMessage && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-rose-50 dark:bg-rose-950/80 rounded-lg border border-rose-200 dark:border-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 dark:text-rose-300">{errorMessage}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/80">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1",
                  isPending ? "opacity-60 cursor-not-allowed" : "",
                  config.buttonBg,
                )}
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPending ? "Processing…" : config.buttonLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
