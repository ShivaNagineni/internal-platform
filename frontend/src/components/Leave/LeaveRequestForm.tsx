import { useState, useEffect, useId } from "react";
import type { ComponentType, FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  CalendarDays,
  Stethoscope,
  DollarSign,
  Baby,
  Heart,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Laptop,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateLeave, useUpdateLeave } from "@/hooks/useLeave";
import type { Leave, LeaveType } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Leave | null;
}

interface LeaveTypeOption {
  value: LeaveType;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  color: string;
  selectedColor: string;
}

const LEAVE_TYPE_OPTIONS: LeaveTypeOption[] = [
  {
    value: "ANNUAL",
    label: "Annual Leave",
    icon: CalendarDays,
    description: "Planned vacation or personal time",
    color: "text-indigo-500",
    selectedColor: "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50",
  },
  {
    value: "SICK",
    label: "Sick Leave",
    icon: Stethoscope,
    description: "Medical illness or injury",
    color: "text-rose-500",
    selectedColor: "border-rose-400 bg-rose-50 dark:bg-rose-950/50",
  },
  {
    value: "UNPAID",
    label: "Unpaid Leave",
    icon: DollarSign,
    description: "Leave without pay",
    color: "text-amber-500",
    selectedColor: "border-amber-400 bg-amber-50 dark:bg-amber-950/50",
  },
  {
    value: "PARENTAL",
    label: "Parental Leave",
    icon: Baby,
    description: "Maternity, paternity or adoption",
    color: "text-emerald-500",
    selectedColor: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/50",
  },
  {
    value: "BEREAVEMENT",
    label: "Bereavement",
    icon: Heart,
    description: "Loss of a family member",
    color: "text-purple-500",
    selectedColor: "border-purple-400 bg-purple-50 dark:bg-purple-950/50",
  },
  {
    value: "WFH",
    label: "Work From Home",
    icon: Laptop,
    description: "Working remotely",
    color: "text-cyan-500",
    selectedColor: "border-cyan-400 bg-cyan-50 dark:bg-cyan-950/50",
  },
];

function countBusinessDays(start: string, end: string): number {
  if (!start || !end) return 0;
  // Append local midnight to prevent UTC date-shift in behind-UTC timezones
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
  if (endDate < startDate) return 0;

  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export default function LeaveRequestForm({ open, onOpenChange, initialData }: Props) {
  const formId = useId();
  const { mutate: createMutate, isPending: isCreating } = useCreateLeave();
  const { mutate: updateMutate, isPending: isUpdating } = useUpdateLeave();
  const isPending = isCreating || isUpdating;

  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [endDateError, setEndDateError] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const businessDays = countBusinessDays(startDate, endDate);
  const today = getTodayString();

  function resetForm() {
    setLeaveType("ANNUAL");
    setStartDate("");
    setEndDate("");
    setReason("");
    setEndDateError("");
    setReasonError("");
    setSubmitStatus("idle");
    setErrorMessage("");
  }

  useEffect(() => {
    if (open) {
      if (initialData) {
        setLeaveType(initialData.leave_type);
        setStartDate(initialData.start_date);
        setEndDate(initialData.end_date);
        setReason(initialData.reason);
      } else {
        resetForm();
      }
    }
  }, [open, initialData]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function validateEndDate(start: string, end: string): boolean {
    if (!end) {
      setEndDateError("End date is required.");
      return false;
    }
    if (end < start) {
      setEndDateError("End date must be on or after start date.");
      return false;
    }
    setEndDateError("");
    return true;
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    if (startDate) validateEndDate(startDate, value);
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (endDate) validateEndDate(value, endDate);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitStatus("idle");
    setErrorMessage("");

    let valid = true;

    if (!validateEndDate(startDate, endDate)) valid = false;

    if (reason.trim().length < 10) {
      setReasonError("Reason must be at least 10 characters.");
      valid = false;
    } else {
      setReasonError("");
    }

    if (!valid) return;

    if (initialData) {
      updateMutate(
        {
          id: initialData.id,
          payload: { leave_type: leaveType, start_date: startDate, end_date: endDate, reason: reason.trim() },
        },
        {
          onSuccess: () => {
            setSubmitStatus("success");
            setTimeout(() => {
              handleOpenChange(false);
            }, 1400);
          },
          onError: (err: unknown) => {
            setSubmitStatus("error");
            const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setErrorMessage(message);
          },
        },
      );
    } else {
      createMutate(
        { leave_type: leaveType, start_date: startDate, end_date: endDate, reason: reason.trim() },
        {
          onSuccess: () => {
            setSubmitStatus("success");
            setTimeout(() => {
              handleOpenChange(false);
            }, 1400);
          },
          onError: (err: unknown) => {
            setSubmitStatus("error");
            const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setErrorMessage(message);
          },
        },
      );
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
            "bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">
                {initialData ? "Edit Leave Request" : "Request Leave"}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {initialData
                  ? "Modify your leave request details."
                  : "Fill in the details to submit your leave request."}
              </Dialog.Description>
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

          {/* Success overlay */}
          {submitStatus === "success" && (
            <div className="absolute inset-0 z-10 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center gap-3 rounded-2xl backdrop-blur-sm">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {initialData ? "Leave request updated!" : "Leave request submitted!"}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Your manager will review it shortly.</p>
            </div>
          )}

          {/* Form */}
          <form id={`${formId}-form`} onSubmit={handleSubmit} noValidate>
            <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto scrollbar-hide">

              {/* Leave Type */}
              {/* Leave Type */}
              {/* Leave Type */}
              <div>
                <label htmlFor={`${formId}-leave-type`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Leave Type <span className="text-rose-500">*</span>
                </label>
                <select
                  id={`${formId}-leave-type`}
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 cursor-pointer"
                >
                  {LEAVE_TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${formId}-start`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`${formId}-start`}
                    type="date"
                    required
                    min={today}
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow duration-150 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-end`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`${formId}-end`}
                    type="date"
                    required
                    min={startDate || today}
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className={cn(
                      "w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow duration-150 [color-scheme:light] dark:[color-scheme:dark]",
                      endDateError ? "border-rose-400 ring-1 ring-rose-300" : "border-slate-200 dark:border-slate-700",
                    )}
                  />
                  {endDateError && (
                    <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {endDateError}
                    </p>
                  )}
                </div>
              </div>

              {/* Business Days Pill */}
              {businessDays > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg border border-indigo-100 dark:border-indigo-900/80">
                  <CalendarDays className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  <span className="text-sm text-indigo-700 dark:text-indigo-300">
                    <span className="font-semibold">{businessDays}</span>{" "}
                    business {businessDays === 1 ? "day" : "days"} selected
                  </span>
                </div>
              )}

              {/* Reason */}
              <div>
                <label htmlFor={`${formId}-reason`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id={`${formId}-reason`}
                  rows={3}
                  required
                  placeholder="Please provide a brief reason (min. 10 characters)..."
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (e.target.value.trim().length >= 10) setReasonError("");
                  }}
                  className={cn(
                    "w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow duration-150",
                    reasonError ? "border-rose-400 ring-1 ring-rose-300" : "border-slate-200 dark:border-slate-700",
                  )}
                />
                <div className="mt-1 flex items-center justify-between">
                  {reasonError ? (
                    <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {reasonError}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span
                    className={cn(
                      "text-xs ml-auto",
                      reason.length < 10 ? "text-slate-400 dark:text-slate-500" : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {reason.length} / 10 min
                  </span>
                </div>
              </div>

              {/* API Error */}
              {submitStatus === "error" && (
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
                disabled={isPending || submitStatus === "success"}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1",
                  isPending || submitStatus === "success"
                    ? "bg-indigo-400 dark:bg-indigo-500/50 text-white cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 dark:shadow-none",
                )}
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPending
                  ? initialData
                    ? "Saving…"
                    : "Submitting…"
                  : initialData
                    ? "Save Changes"
                    : "Submit Request"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
