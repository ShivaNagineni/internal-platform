import * as Dialog from "@radix-ui/react-dialog";
import { X, LogOut, ShieldCheck, Mail, Building2, Key, UserCheck } from "lucide-react";
import { useMsal, useAccount } from "@azure/msal-react";
import { cn, getInitials } from "@/lib/utils";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);

  const displayName = account?.name ?? "User";
  const email = account?.username?.toLowerCase() ?? "";
  const initials = getInitials(displayName);

  // Determine role
  let roleLabel = "Employee";
  let roleColor = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";

  if (email === "shiva.nagineni@tekyantra.com" || email === "shiva.kumar.nagineni@gmail.com") {
    roleLabel = "Owner";
    roleColor = "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
  } else {
    const claims = account?.idTokenClaims as Record<string, unknown> | undefined;
    const roles = claims?.roles as string[] | undefined;
    const upperRoles = roles?.map((r) => r.toUpperCase()) ?? [];

    if (upperRoles.includes("OWNER")) {
      roleLabel = "Owner";
      roleColor = "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    } else if (upperRoles.includes("ADMIN")) {
      roleLabel = "Admin";
      roleColor = "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    } else if (upperRoles.includes("MANAGER")) {
      roleLabel = "Manager";
      roleColor = "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    }
  }

  function handleSignOut(): void {
    instance.logoutPopup({
      postLogoutRedirectUri: window.location.origin,
    }).catch(console.error);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 focus:outline-none transition-colors duration-300">
            {/* Top gradient banner */}
            <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative p-4 flex justify-end items-start">
              <Dialog.Close className="w-8 h-8 rounded-full bg-black/20 text-white hover:bg-black/40 flex items-center justify-center transition-colors backdrop-blur-md">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            {/* Avatar & Basic Info */}
            <div className="px-6 pb-6 relative">
              <div className="flex items-end justify-between -mt-12 mb-4">
                <div className="w-24 h-24 rounded-2xl bg-slate-900 border-4 border-white dark:border-slate-900 shadow-xl flex items-center justify-center text-white text-3xl font-bold tracking-tight">
                  {initials}
                </div>
                <span className={cn("px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm flex items-center gap-1.5 uppercase tracking-wider", roleColor)}>
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  {roleLabel}
                </span>
              </div>

              <div>
                <Dialog.Title className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  {displayName}
                </Dialog.Title>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  {email || "No email available"}
                </p>
              </div>

              {/* Organization & SSO info strip */}
              <div className="mt-6 space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    <span>Organization</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">Tekyantra Inc.</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <span>Authentication</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">Microsoft Entra ID</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>Session Status</span>
                  </div>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full text-[10px]">Active</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-600 dark:hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white font-semibold text-sm border border-rose-200 dark:border-rose-900/80 hover:border-rose-600 transition-all shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
