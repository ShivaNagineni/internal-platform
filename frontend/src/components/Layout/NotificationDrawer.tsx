import * as Dialog from "@radix-ui/react-dialog";
import { X, Bell, CalendarDays, Lightbulb, Rocket, Info, CheckCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NotificationDrawer({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleItemClick(id: string, link: string | null) {
    markRead(id);
    if (link) {
      navigate(link);
      onOpenChange(false);
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case "LEAVE":
        return <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "IDEA":
        return <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "RELEASE":
        return <Rocket className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  }

  function getIconBg(type: string) {
    switch (type) {
      case "LEAVE":
        return "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-100 dark:border-emerald-800";
      case "IDEA":
        return "bg-amber-50 dark:bg-amber-950/80 border-amber-100 dark:border-amber-800";
      case "RELEASE":
        return "bg-purple-50 dark:bg-purple-950/80 border-purple-100 dark:border-purple-800";
      default:
        return "bg-blue-50 dark:bg-blue-950/80 border-blue-100 dark:border-blue-800";
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className={cn(
            "fixed z-50 right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-100 dark:border-slate-800",
            "flex flex-col focus:outline-none transition-colors duration-300",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-300 ease-in-out"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-900 dark:text-white leading-none">
                  Notifications
                </Dialog.Title>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {unreadCount} unread update{unreadCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  disabled={isMarkingAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors duration-150 shadow-sm disabled:opacity-50"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Mark all read
                </button>
              )}

              <Dialog.Close className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">Loading updates...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">No notifications yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-normal">
                  When leave requests, ideas, or releases are updated, you'll see them here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                let timeStr = "";
                try {
                  timeStr = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true });
                } catch {
                  timeStr = "recently";
                }

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif.id, notif.link)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3.5 group relative overflow-hidden",
                      notif.is_read
                        ? "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
                        : "bg-indigo-50/40 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-800/80 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/60 font-medium"
                    )}
                  >
                    {!notif.is_read && (
                      <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 ring-4 ring-indigo-100 dark:ring-indigo-950 flex-shrink-0" />
                    )}

                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-sm",
                        getIconBg(notif.type)
                      )}
                    >
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{notif.title}</h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2.5">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {timeStr}
                        </span>
                        {notif.link && (
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                            View details
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
