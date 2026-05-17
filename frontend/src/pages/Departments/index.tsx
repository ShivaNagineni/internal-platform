import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { Department, LocationType } from "@/types";
import { cn } from "@/lib/utils";
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from "@/hooks/useDepartments";
import { useUsers } from "@/hooks/useUsers";

function AddDepartmentRow({ onSave, onCancel }: { onSave: (name: string, description: string, location: LocationType) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<LocationType>("ONSHORE");

  return (
    <tr className="bg-indigo-50/50 border-b border-indigo-100">
      <td className="px-5 py-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim(), description.trim(), location);
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Department name"
          className="text-sm border border-indigo-200 rounded-lg px-2.5 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim(), description.trim(), location);
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Description (optional)"
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value as LocationType)}
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="ONSHORE">Onshore</option>
          <option value="OFFSHORE">Offshore</option>
        </select>
      </td>
      <td className="px-4 py-3" />
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (name.trim()) onSave(name.trim(), description.trim(), location); }}
            disabled={!name.trim()}
            className="flex items-center gap-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditDepartmentRow({ dept, onSave, onCancel }: { dept: Department; onSave: (name: string, description: string, location: LocationType) => void; onCancel: () => void }) {
  const [name, setName] = useState(dept.name);
  const [description, setDescription] = useState(dept.description ?? "");
  const [location, setLocation] = useState<LocationType>(dept.location || "ONSHORE");

  return (
    <tr className="bg-indigo-50/30">
      <td className="px-5 py-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim(), description.trim(), location);
            if (e.key === "Escape") onCancel();
          }}
          className="text-sm border border-indigo-200 rounded-lg px-2.5 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim(), description.trim(), location);
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Description (optional)"
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value as LocationType)}
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="ONSHORE">Onshore</option>
          <option value="OFFSHORE">Offshore</option>
        </select>
      </td>
      <td className="px-4 py-3" />
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (name.trim()) onSave(name.trim(), description.trim(), location); }}
            disabled={!name.trim()}
            className="flex items-center gap-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DepartmentsPage() {
  const [showAddRow, setShowAddRow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: departments = [], isLoading: deptsLoading } = useDepartments();
  const { data: users = [] } = useUsers("name", false);
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();

  const userCountByDept: Record<string, number> = {};
  for (const user of users) {
    if (user.department) {
      userCountByDept[user.department] = (userCountByDept[user.department] ?? 0) + 1;
    }
  }

  function handleCreate(name: string, description: string, location: LocationType) {
    createDept.mutate(
      { name, description: description || null, location },
      { onSuccess: () => setShowAddRow(false) }
    );
  }

  function handleUpdate(id: string, name: string, description: string, location: LocationType) {
    updateDept.mutate(
      { id, name, description: description || null, location },
      { onSuccess: () => setEditingId(null) }
    );
  }

  function handleDelete(id: string) {
    deleteDept.mutate(id, { onSuccess: () => setDeletingId(null) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Departments
            <Building2 className="w-5 h-5 text-indigo-500" />
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage departments and their members.</p>
        </div>
        <button
          onClick={() => { setShowAddRow(true); setEditingId(null); }}
          className="flex items-center gap-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {deptsLoading ? (
          <div className="p-8 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Description</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Location</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Users</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {showAddRow && (
                <AddDepartmentRow
                  onSave={handleCreate}
                  onCancel={() => setShowAddRow(false)}
                />
              )}
              {departments.length === 0 && !showAddRow ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-400 text-sm">
                    No departments yet. Add one to get started.
                  </td>
                </tr>
              ) : (
                departments.map((dept) =>
                  editingId === dept.id ? (
                    <EditDepartmentRow
                      key={dept.id}
                      dept={dept}
                      onSave={(name, description, location) => handleUpdate(dept.id, name, description, location)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <span className="text-sm font-medium text-slate-800">{dept.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-sm", dept.description ? "text-slate-600" : "text-slate-400 italic")}>
                          {dept.description ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                          dept.location === "ONSHORE" 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                            : "bg-sky-50 text-sky-600 border-sky-200"
                        )}>
                          {dept.location === "ONSHORE" ? "Onshore" : "Offshore"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {userCountByDept[dept.name] ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {deletingId === dept.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600">Delete?</span>
                            <button
                              onClick={() => handleDelete(dept.id)}
                              className="text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => { setEditingId(dept.id); setShowAddRow(false); setDeletingId(null); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setDeletingId(dept.id); setEditingId(null); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
