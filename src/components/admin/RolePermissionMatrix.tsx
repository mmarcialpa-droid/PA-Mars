import React, { useState } from 'react';
import { ShieldAlert, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PermissionScope } from '../../types';
import { SYSTEM_PERMISSIONS, PERMISSION_CATEGORIES } from '../../constants/permissions';

export const RolePermissionMatrix: React.FC = () => {
  const { roles, createRole, updateRole, deleteRole, isSuperAdmin, showToast } = useApp();

  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || 'role_super_admin');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [roleIdToDelete, setRoleIdToDelete] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = roles.find(r => r.id === selectedRoleId) || roles[0];

  const handleTogglePermission = async (permId: string) => {
    if (!selectedRole || selectedRole.id === 'role_super_admin') return;

    const exists = selectedRole.permissions.includes(permId);
    const updatedPerms = exists 
      ? selectedRole.permissions.filter(p => p !== permId)
      : [...selectedRole.permissions, permId];

    const updatedScopes = { 
      ...(selectedRole.scopes || {}), 
      [permId]: selectedRole.scopes?.[permId] || 'department' as PermissionScope 
    };

    try {
      await updateRole(selectedRole.id, { 
        permissions: updatedPerms,
        scopes: updatedScopes
      });
    } catch (err: unknown) {
      console.warn(err);
    }
  };

  const handleChangeScope = async (permId: string, scope: PermissionScope) => {
    if (!selectedRole || selectedRole.id === 'role_super_admin') return;

    const updatedScopes = { 
      ...(selectedRole.scopes || {}), 
      [permId]: scope 
    };

    try {
      await updateRole(selectedRole.id, { scopes: updatedScopes });
    } catch (err: unknown) {
      console.warn(err);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const created = await createRole({
        name: newRoleName.trim(),
        description: newRoleDescription.trim(),
        level: 5,
        isSystemRole: false,
        permissions: ['view_tasks', 'view_projects'],
        scopes: { view_tasks: 'project', view_projects: 'project' }
      });
      setSelectedRoleId(created.id);
      setIsCreateModalOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create role.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!roleIdToDelete) return;
    setLoading(true);
    try {
      await deleteRole(roleIdToDelete);
      const remaining = roles.filter(r => r.id !== roleIdToDelete);
      setSelectedRoleId(remaining[0]?.id || '');
      setRoleIdToDelete(null);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Cannot delete role.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Roles & Granular Permission Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure system roles and custom access tiers across 8 operational categories.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom Role</span>
          </button>
        )}
      </div>

      {/* Role Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedRoleId(r.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedRoleId === r.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {r.id === 'role_super_admin' && <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />}
            <span>{r.name}</span>
            {r.isSystemRole && (
              <span className={`text-[9px] px-1 rounded uppercase tracking-wider font-mono ${
                selectedRoleId === r.id ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
              }`}>
                System
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Role Details & Permissions Table */}
      {selectedRole && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{selectedRole.name}</h3>
                {selectedRole.id === 'role_super_admin' && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    Immutable Root Authority
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">{selectedRole.description}</p>
            </div>

            {!selectedRole.isSystemRole && isSuperAdmin && (
              <button
                onClick={() => setRoleIdToDelete(selectedRole.id)}
                className="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1 p-1"
                title="Delete Role"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Role</span>
              </button>
            )}
          </div>

          {/* Matrix by Category */}
          <div className="divide-y divide-slate-100">
            {PERMISSION_CATEGORIES.map(cat => {
              const permsInCat = SYSTEM_PERMISSIONS.filter(p => p.category === cat.id);

              return (
                <div key={cat.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-slate-400">· {cat.description}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {permsInCat.map(perm => {
                      const isSuper = selectedRole.id === 'role_super_admin';
                      const isChecked = isSuper || (selectedRole.permissions || []).includes(perm.id);
                      const activeScope = selectedRole.scopes?.[perm.id] || perm.defaultScope;

                      return (
                        <div
                          key={perm.id}
                          className={`p-2.5 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-slate-50/90 border-slate-300/80 text-slate-900'
                              : 'bg-white border-slate-200/70 text-slate-400'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isSuper}
                              onChange={() => handleTogglePermission(perm.id)}
                              className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-0 disabled:opacity-50"
                            />
                            <div className="min-w-0">
                              <p className={`font-semibold truncate ${isChecked ? 'text-slate-900' : 'text-slate-500'}`}>
                                {perm.name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                                {perm.description}
                              </p>
                            </div>
                          </div>

                          {isChecked && !isSuper && (
                            <select
                              value={activeScope}
                              onChange={(e) => handleChangeScope(perm.id, e.target.value as PermissionScope)}
                              className="px-2 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono font-medium text-slate-700"
                            >
                              <option value="organization">organization</option>
                              <option value="department">department</option>
                              <option value="project">project</option>
                              <option value="assigned">assigned</option>
                              <option value="own">own</option>
                            </select>
                          )}

                          {isSuper && (
                            <span className="text-[10px] font-mono text-amber-700 font-semibold shrink-0">
                              all scopes
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Custom Role</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateRole} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Name</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Creative Reviewer / External Auditor"
                  required
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  rows={2}
                  placeholder="Specify role responsibility and scope..."
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newRoleName.trim()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold"
                >
                  {loading ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Role Confirmation Modal */}
      {roleIdToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Custom Role</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete this custom role? Users assigned solely to this role may lose access permissions.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setRoleIdToDelete(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={confirmDeleteRole}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold"
              >
                {loading ? 'Deleting...' : 'Delete Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
