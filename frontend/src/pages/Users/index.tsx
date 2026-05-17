import { useState } from "react";
import { Users, RefreshCw, Search, Shield, Building2, ToggleLeft, ToggleRight, Edit2, Check, X } from "lucide-react";
import type { User, UserRole } from "@/types";
import { cn, getInitials } from "@/lib/utils";
import { useUsers, useUpdateUserRole, useUpdateUser, useToggleUserActive, useSyncZohoUsers } from "@/hooks/useUsers";

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<UserRole, string> = {
  OWNER:    "bg-amber-100 text-amber-800 border-amber-200",
  ADMIN:    "bg-rose-100 text-rose-700 border-rose-200",
  MANAGER:  "bg-indigo-100 text-indigo-700 border-indigo-200",
  EMPLOYEE: "bg-slate-100 text-slate-600 border-slate-200",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", ROLE_STYLES[role])}>
      {role}
    </span>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ user }: { user: User }) {
  const hasAzure = Boolean(user.azure_oid);
  const hasZoho = Boolean(user.zoho_uid);
  if (hasAzure && hasZoho) return <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full font-medium">AD + Zoho</span>;
  if (hasAzure) return <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">Azure AD</span>;
  if (hasZoho) return <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-medium">Zoho</span>;
  return <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-medium">Manual</span>;
}

// ─── Inline editable field ────────────────────────────────────────────────────

function InlineEdit({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="flex items-center gap-1 text-xs text-slate-600 hover:text-indigo-600 group"
      >
        <span className={value ? "" : "italic text-slate-400"}>{value || placeholder || "—"}</span>
        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="text-xs border border-slate-200 rounded px-1.5 py-0.5 w-32 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const { data: users = [], isLoading } = useUsers("name", !showInactive);
  const updateRole = useUpdateUserRole();
  const updateUser = useUpdateUser();
  const toggleActive = useToggleUserActive();
  const syncZoho = useSyncZohoUsers();

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function handleSync() {
    setSyncResult(null);
    syncZoho.mutate(undefined, {
      onSuccess: (r) => setSyncResult(`Sync complete — ${r.created} created, ${r.updated} updated, ${r.skipped} unchanged`),
      onError: (e) => setSyncResult(`Sync failed: ${e.message}`),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Team Members
            <Users className="w-5 h-5 text-indigo-500" />
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage roles and departments for all users.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncZoho.isPending}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors duration-150"
        >
          <RefreshCw className={cn("w-4 h-4", syncZoho.isPending && "animate-spin")} />
          {syncZoho.isPending ? "Syncing…" : "Sync from Zoho People"}
        </button>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={cn(
          "text-sm px-4 py-3 rounded-xl border",
          syncResult.startsWith("Sync failed")
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        )}>
          {syncResult}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or department…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
          Show inactive
        </label>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} users</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[0,1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No users found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">User</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Department</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Source</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((user) => (
                <tr key={user.id} className={cn("hover:bg-slate-50 transition-colors", !user.is_active && "opacity-50")}>
                  {/* User */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white text-xs font-semibold leading-none">{getInitials(user.display_name)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800 leading-tight">{user.display_name}</p>
                        <p className="text-xs text-slate-400 leading-tight">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Department */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      <InlineEdit
                        value={user.department ?? ""}
                        placeholder="Add department"
                        onSave={(department) => updateUser.mutate({ id: user.id, department })}
                      />
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      <select
                        value={user.role}
                        onChange={(e) => updateRole.mutate({ id: user.id, role: e.target.value as UserRole })}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                      >
                        <option value="EMPLOYEE">Employee</option>
                        <option value="MANAGER">Manager</option>
                        <option value="ADMIN">Admin</option>
                        <option value="OWNER">Owner</option>
                      </select>
                    </div>
                  </td>

                  {/* Source */}
                  <td className="px-4 py-3"><SourceBadge user={user} /></td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive.mutate(user.id)}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {user.is_active
                        ? <><ToggleRight className="w-5 h-5 text-emerald-500" /><span>Active</span></>
                        : <><ToggleLeft className="w-5 h-5 text-slate-400" /><span>Inactive</span></>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
