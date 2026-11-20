import React, { useState } from 'react';
import { Building2, Plus, Edit2, Users, Layers, ChevronRight, X, AlertCircle, Trash2, Power } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Department } from '../../types';

export const DepartmentManager: React.FC = () => {
  const { departments, createDepartment, updateDepartment, deleteDepartment, allUsers, isSuperAdmin, isAdmin, showToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentDepartmentId, setParentDepartmentId] = useState<string | null>(null);
  const [headUserId, setHeadUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingDept(null);
    setName('');
    setDescription('');
    setParentDepartmentId(null);
    setHeadUserId(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setParentDepartmentId(dept.parentDepartmentId || null);
    setHeadUserId(dept.headUserId || dept.departmentHeadId || null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      if (editingDept) {
        if (parentDepartmentId === editingDept.id) {
          throw new Error('A department cannot be its own parent department.');
        }
        await updateDepartment(editingDept.id, {
          name: name.trim(),
          description: description.trim(),
          parentDepartmentId: parentDepartmentId || null,
          headUserId: headUserId || null,
          departmentHeadId: headUserId || null
        });
      } else {
        await createDepartment({
          name: name.trim(),
          description: description.trim(),
          parentDepartmentId: parentDepartmentId || null,
          headUserId: headUserId || null,
          departmentHeadId: headUserId || null
        });
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save department.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Group root departments vs sub-departments
  const rootDepts = departments.filter(d => !d.parentDepartmentId);
  const getSubDepts = (parentId: string) => departments.filter(d => d.parentDepartmentId === parentId);

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Departments Hierarchy
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize teams into primary business units and nested sub-departments.
          </p>
        </div>

        {(isSuperAdmin || isAdmin) && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Department</span>
          </button>
        )}
      </div>

      {/* Departments Grid & Hierarchy View */}
      {departments.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No departments configured</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create departments to group projects, members, and organizational approvals.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Add First Department
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rootDepts.map(dept => {
            const subDepts = getSubDepts(dept.id);
            const deptUsers = allUsers.filter(u => u.departmentId === dept.id);
            const headUser = allUsers.find(u => u.id === (dept.headUserId || dept.departmentHeadId));

            return (
              <div key={dept.id} className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{dept.name}</h3>
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          Root Department
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{dept.description || 'No description provided.'}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{deptUsers.length} active members</span>
                        </span>
                        {headUser && (
                          <span className="flex items-center gap-1.5">
                            <span className="text-slate-400">Head:</span>
                            <span className="font-semibold text-slate-700">{headUser.name}</span>
                          </span>
                        )}
                        {subDepts.length > 0 && (
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            <span>{subDepts.length} sub-units</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(isSuperAdmin || isAdmin) && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateDepartment(dept.id, { status: dept.status === 'active' ? 'archived' : 'active' })}
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                          dept.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title={dept.status === 'active' ? 'Deactivate Department' : 'Activate Department'}
                      >
                        <Power className="w-3 h-3 inline mr-1" />
                        {dept.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(dept)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-50"
                        title="Edit Department"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deleteDepartment(dept.id);
                          } catch (err: unknown) {
                            showToast('error', err instanceof Error ? err.message : 'Cannot delete department.');
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub-departments listing */}
                {subDepts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 pl-4 space-y-2">
                    {subDepts.map(sub => {
                      const subUsers = allUsers.filter(u => u.departmentId === sub.id);
                      const subHead = allUsers.find(u => u.id === (sub.headUserId || sub.departmentHeadId));
                      return (
                        <div key={sub.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-slate-800">{sub.name}</span>
                            <span className="text-[11px] text-slate-500">· {subUsers.length} members</span>
                            {subHead && (
                              <span className="text-[11px] text-slate-500">· Head: {subHead.name}</span>
                            )}
                          </div>
                          {(isSuperAdmin || isAdmin) && (
                            <button
                              onClick={() => handleOpenEdit(sub)}
                              className="text-slate-400 hover:text-slate-700 p-1"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Create/Edit Department */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingDept ? 'Edit Department' : 'Create New Department'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Design & User Experience"
                  required
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Scope and purpose of this department..."
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Parent Department (Optional)
                </label>
                <select
                  value={parentDepartmentId || ''}
                  onChange={(e) => setParentDepartmentId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">None (Top-Level / Root Department)</option>
                  {departments
                    .filter(d => !editingDept || d.id !== editingDept.id)
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department Head (Optional)
                </label>
                <select
                  value={headUserId || ''}
                  onChange={(e) => setHeadUserId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">Unassigned</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {loading ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
