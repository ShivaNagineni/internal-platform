import { useState, useEffect } from "react";
import { useMsal, useAccount } from "@azure/msal-react";
import { NavLink, useLocation } from "react-router-dom";
import { getZohoUser, clearZohoSession, isZohoAuthenticated } from "@/lib/zohoAuth";
import {
  LayoutDashboard,
  CalendarDays,
  Lightbulb,
  Rocket,
  Users,
  Building2,
  Bell,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ClipboardList,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import * as Tooltip from "@radix-ui/react-tooltip";
import NotificationDrawer from "@/components/Layout/NotificationDrawer";
import ProfileModal from "@/components/Layout/ProfileModal";
import { useNotifications } from "@/hooks/useNotifications";
import { useCurrentUser, useUpdateTheme } from "@/hooks/useUsers";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: "MANAGER" | "ADMIN" | "OWNER";
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Leave Tracker", to: "/leave", icon: CalendarDays },
  { label: "Innovation Hub", to: "/ideas", icon: Lightbulb },
  { label: "Release Control", to: "/releases", icon: Rocket },
  { label: "Azure Stories", to: "/stories", icon: ClipboardList },
  { label: "Team Members", to: "/users", icon: Users },
  // { label: "Departments", to: "/departments", icon: Building2 },
];

const ROLE_RANK: Record<string, number> = {
  EMPLOYEE: 0,
  MANAGER: 1,
  ADMIN: 2,
  OWNER: 3,
};

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leave": "Leave Tracker",
  "/ideas": "Innovation Hub",
  "/releases": "Release Control",
  "/stories": "Azure Stories",
  "/users": "Team Members",
  "/departments": "Departments",
};

function getPageTitle(pathname: string): string {
  return ROUTE_TITLES[pathname] ?? "Internal Platform";
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const { data: currentUser } = useCurrentUser();
  const updateTheme = useUpdateTheme();

  useEffect(() => {
    if (currentUser?.theme) {
      localStorage.setItem("theme", currentUser.theme);
      if (currentUser.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [currentUser?.theme]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const zohoUser = isZohoAuthenticated() ? getZohoUser() : null;
  const displayName: string = zohoUser?.display_name ?? account?.name ?? "User";
  const email: string = zohoUser?.email ?? account?.username ?? "";
  const initials: string = getInitials(displayName);
  const pageTitle: string = getPageTitle(location.pathname);

  function handleSignOut(): void {
    if (zohoUser) {
      clearZohoSession();
      window.location.href = "/";
    } else {
      instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
      }).catch(console.error);
    }
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-[1px_0_12px_0_rgba(15,23,42,0.06)] flex flex-col z-20 transition-all duration-300 ease-in-out",
            sidebarCollapsed ? "w-20" : "w-64"
          )}
        >
          {/* Logo area */}
          <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-white text-sm font-bold tracking-tight">IP</span>
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 animate-in fade-in duration-200">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate">
                    Internal Platform
                  </p>
                  <p className="text-xs text-slate-400 leading-tight truncate mt-0.5">
                    tekyantra.com
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
            {!sidebarCollapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none animate-in fade-in duration-200">
                Navigation
              </p>
            )}
            {NAV_ITEMS.filter(({ minRole }) =>
              !minRole || (currentUser && ROLE_RANK[currentUser.role] >= ROLE_RANK[minRole])
            ).map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={sidebarCollapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group select-none",
                    sidebarCollapsed && "justify-center px-0",
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0 transition-colors duration-150",
                        isActive
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                      )}
                    />
                    {!sidebarCollapsed && <span className="truncate animate-in fade-in duration-200">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom user section */}
          <div className="px-3 py-4 border-t border-slate-100 dark:border-slate-800">
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-all",
                sidebarCollapsed && "justify-center px-1"
              )}
            >
              {/* Avatar */}
              <div
                onClick={() => setProfileOpen(true)}
                title={displayName}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
              >
                <span className="text-white text-xs font-semibold leading-none">
                  {initials}
                </span>
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0 animate-in fade-in duration-200">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                      {email}
                    </p>
                  </div>
                  {/* Sign out */}
                  <button
                    onClick={handleSignOut}
                    title="Sign out"
                    className="flex-shrink-0 p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors duration-150"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div
          className={cn(
            "flex flex-col flex-1 min-h-screen overflow-hidden transition-all duration-300 ease-in-out",
            sidebarCollapsed ? "ml-20" : "ml-64"
          )}
        >
          {/* Top header bar */}
          <header className="h-16 flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-10 shadow-sm transition-colors duration-300">
            <div className="flex items-center gap-3">
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="p-2 rounded-lg text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="bottom"
                    sideOffset={6}
                    className="z-50 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded-lg shadow-md animate-in fade-in-0 zoom-in-95 duration-150"
                  >
                    {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    <Tooltip.Arrow className="fill-slate-800" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
              <h1 className="text-base font-semibold text-slate-800 dark:text-white tracking-tight">
                {pageTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button
                onClick={() => {
                  const newTheme = currentUser?.theme === "dark" ? "light" : "dark";
                  if (currentUser) updateTheme.mutate({ id: currentUser.id, theme: newTheme });
                }}
                title={currentUser?.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="p-2 rounded-lg text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150"
              >
                {currentUser?.theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Notification bell */}
              <button
                onClick={() => setDrawerOpen(true)}
                title="Notifications"
                className="relative p-2 rounded-lg text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-indigo-600 rounded-full ring-2 ring-white" />
                )}
              </button>

              {/* User avatar button */}
              <button
                onClick={() => setProfileOpen(true)}
                title={displayName}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
              >
                <span className="text-white text-xs font-semibold leading-none">
                  {initials}
                </span>
              </button>
            </div>
          </header>

          {/* Scrollable page content */}
          <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <div className="p-6 min-h-full">
              {children}
            </div>
          </main>
        </div>

        <NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
        <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    </Tooltip.Provider>
  );
}
