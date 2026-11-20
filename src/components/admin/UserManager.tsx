import React, { useState } from 'react';
import {
  Users,
  Search,
  UserX,
  UserCheck,
  UserPlus,
  Edit2,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Archive,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';

function generateStrongInitialPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length]
  ];
  for (let i = 4; i < 14; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const UserManager: React.FC = () => {
  const {
    allUsers,
    departments,
    positions,
    roles,
    updateUserAssignments,
    suspendUser,
    reactivateUser,
    adminCreateUserAccount,
    approvePendingUser,
    archiveUserAccount,
    deleteUserAccount,
    isSuperAdmin,
    isAdmin,
    currentUser,
    showToast
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'pending_approval' | 'suspended' | 'rejected' | 'archived'
  >('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedPosId, setSelectedPosId] = useState<string | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStatusUser, setConfirmStatusUser] = useState<User | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);

  // Admin-create user modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newDeptId, setNewDeptId] = useState<string | null>(null);
  const [newPosId, setNewPosId] = useState<string | null>(null);
  const [newRoleIds, setNewRoleIds] = useState<string[]>(['role_member']);
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    employeeId?: string | null;
    initialPassword?: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setSelectedDeptId(user.departmentId || null);
    setSelectedPosId(user.positionId || null);
    setSelectedManagerId(user.managerId || null);
    setSelectedRoleIds(user.roleIds || []);
    setError(null);
  };

  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setError(null);
    try {
      await updateUserAssignments(editingUser.id, {
        departmentId: selectedDeptId,
        positionId: selectedPosId,
        managerId: selectedManagerId,
        roleIds: selectedRoleIds,
        primaryRoleId: selectedRoleIds[0] || 'role_member'
      });
      setEditingUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update user assignments.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspend = (user: User) => {
    if (user.id === currentUser?.id) {
      showToast('error', 'You cannot suspend your own account.');
      return;
    }
    if ((user.roleIds || []).includes('role_super_admin')) {
      showToast('error', 'The Super Administrator account cannot be suspended.');
      return;
    }
    setConfirmStatusUser(user);
  };

  const confirmToggleStatus = async () => {
    if (!confirmStatusUser) return;
    setLoading(true);
    try {
      if (confirmStatusUser.accountStatus === 'active') {
        await suspendUser(confirmStatusUser.id);
      } else {
        await reactivateUser(confirmStatusUser.id);
      }
      setConfirmStatusUser(null);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update account status.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      showToast('error', 'You cannot archive your own active session.');
      return;
    }
    if ((user.roleIds || []).includes('role_super_admin')) {
      showToast('error', 'The Super Administrator account cannot be archived.');
      return;
    }
    try {
      await archiveUserAccount(user.id);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to archive account.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteUser) return;
    setLoading(true);
    try {
      await deleteUserAccount(confirmDeleteUser.id);
      setConfirmDeleteUser(null);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete user account.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    if (selectedRoleIds.includes(roleId)) {
      if (selectedRoleIds.length === 1) return;
      setSelectedRoleIds((prev) => prev.filter((r) => r !== roleId));
    } else {
      setSelectedRoleIds((prev) => [...prev, roleId]);
    }
  };

  const handleOpenCreateModal = () => {
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewEmployeeId('');
    setNewDeptId(departments[0]?.id || null);
    setNewPosId(positions[0]?.id || null);
    setNewRoleIds(['role_member']);
    setInitialPassword(generateStrongInitialPassword());
    setShowInitialPassword(false);
    setCreateError(null);
    setCreatedCredentials(null);
    setCopiedPassword(false);
    setIsCreateModalOpen(true);
  };

  const toggleNewRoleSelection = (roleId: string) => {
    if (roleId === 'role_super_admin' && !isSuperAdmin) return;
    if (newRoleIds.includes(roleId)) {
      if (newRoleIds.length === 1) return;
      setNewRoleIds((prev) => prev.filter((r) => r !== roleId));
    } else {
      setNewRoleIds((prev) => [...prev, roleId]);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim()) {
      setCreateError('First name, last name, and email address are required.');
      return;
    }

    if (initialPassword.length < 8) {
      setCreateError('Initial password must be at least 8 characters long.');
      return;
    }

    setCreateLoading(true);
    try {
      const result = await adminCreateUserAccount({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        email: newEmail.trim().toLowerCase(),
        employeeId: newEmployeeId.trim() || null,
        departmentId: newDeptId || null,
        positionId: newPosId || null,
        roleIds: newRoleIds,
        temporaryPassword: initialPassword
      });
      setCreatedCredentials({
        name: result.user.name,
        email: result.user.email,
        employeeId: result.user.employeeId,
        initialPassword: result.initialPassword || initialPassword
      });
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user account.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCopyInitialPassword = async () => {
    if (!createdCredentials?.initialPassword) return;
    try {
      await navigator.clipboard.writeText(createdCredentials.initialPassword);
      setCopiedPassword(true);
      showToast('success', 'Initial password copied to clipboard.');
      window.setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      showToast('error', 'Unable to copy password.');
    }
  };

  const handleApprovePendingUser = async (user: User) => {
    setApprovingUserId(user.id);
    try {
      await approvePendingUser(user.id);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Could not approve account.');
    } finally {
      setApprovingUserId(null);
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.employeeId || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || u.accountStatus === statusFilter;
    const matchesDept = deptFilter === 'all' || u.departmentId === deptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Centralized Team Directory ({allUsers.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Provision Email &amp; Password accounts, approve pending signups, and manage organizational roles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search name, email, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 w-52"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as
                  | 'all'
                  | 'active'
                  | 'pending_approval'
                  | 'suspended'
                  | 'rejected'
                  | 'archived'
              )
            }
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Accounts</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {(isSuperAdmin || isAdmin) && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create User Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No users match filters</h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search criteria or invite new members from the Invitations tab.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-4">Assigned Roles</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const dept = departments.find((d) => d.id === user.departmentId);
                  const pos = positions.find((p) => p.id === user.positionId);
                  const userRoles = roles.filter((r) => (user.roleIds || []).includes(r.id));
                  const isCurrent = user.id === currentUser?.id;
                  const isTargetSuperAdmin = (user.roleIds || []).includes('role_super_admin');

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  (You)
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {user.email}
                              {user.employeeId ? ` · ${user.employeeId}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {dept ? (
                          <span className="font-medium text-slate-800">{dept.name}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {pos ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">{pos.title}</span>
                            <span className="text-[10px] font-mono-tabular text-purple-700">
                              L{pos.level}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {userRoles.map((r) => (
                            <span
                              key={r.id}
                              className={`text-[11px] font-semibold ${
                                r.id === 'role_super_admin'
                                  ? 'text-amber-800'
                                  : r.id === 'role_admin'
                                  ? 'text-blue-800'
                                  : 'text-slate-700'
                              }`}
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                            user.accountStatus === 'active'
                              ? 'text-emerald-700'
                              : user.accountStatus === 'pending_approval'
                              ? 'text-amber-700'
                              : user.accountStatus === 'archived'
                              ? 'text-slate-600'
                              : 'text-rose-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              user.accountStatus === 'active'
                                ? 'bg-emerald-500'
                                : user.accountStatus === 'pending_approval'
                                ? 'bg-amber-500'
                                : user.accountStatus === 'archived'
                                ? 'bg-slate-400'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span className="capitalize">
                            {(user.accountStatus || 'active').replace(/_/g, ' ')}
                          </span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {(isSuperAdmin || isAdmin) && (
                          <div className="flex items-center justify-end gap-1">
                            {user.accountStatus === 'pending_approval' && (
                              <button
                                type="button"
                                disabled={approvingUserId === user.id}
                                onClick={() => handleApprovePendingUser(user)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold disabled:opacity-50"
                                title="Approve Pending Registration"
                              >
                                {approvingUserId === user.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                <span>Approve</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEdit(user)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
                              title="Edit Assignments"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {!isCurrent &&
                              !isTargetSuperAdmin &&
                              (user.accountStatus === 'active' || user.accountStatus === 'suspended') && (
                                <button
                                  onClick={() => handleToggleSuspend(user)}
                                  className={`p-1.5 rounded-md ${
                                    user.accountStatus === 'active'
                                      ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                      : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={user.accountStatus === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                                >
                                  {user.accountStatus === 'active' ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                            {!isCurrent && !isTargetSuperAdmin && user.accountStatus !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => handleArchiveUser(user)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                                title="Archive Account"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!isCurrent && !isTargetSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUser(user)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                                title="Delete Profile"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Assignments: {editingUser.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveAssignments} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <select
                  value={selectedDeptId || ''}
                  onChange={(e) => setSelectedDeptId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Position &amp; Seniority Level
                </label>
                <select
                  value={selectedPosId || ''}
                  onChange={(e) => setSelectedPosId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">Unassigned</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (Level {p.level})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reporting Manager
                </label>
                <select
                  value={selectedManagerId || ''}
                  onChange={(e) => setSelectedManagerId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">No Reporting Manager</option>
                  {allUsers
                    .filter((u) => u.accountStatus === 'active' && u.id !== editingUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Assigned Roles (Select all applicable)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const isSelected = selectedRoleIds.includes(r.id);
                    const isSuper = editingUser.id === 'user_admin_initial' && r.id === 'role_super_admin';

                    return (
                      <button
                        type="button"
                        key={r.id}
                        disabled={isSuper}
                        onClick={() => toggleRoleSelection(r.id)}
                        className={`p-2 rounded-lg border text-left transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-semibold">{r.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold"
                >
                  {loading ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Suspend / Reactivate Modal */}
      {confirmStatusUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  confirmStatusUser.accountStatus === 'active'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {confirmStatusUser.accountStatus === 'active' ? (
                  <UserX className="w-4 h-4" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {confirmStatusUser.accountStatus === 'active'
                    ? 'Suspend User Account'
                    : 'Reactivate User Account'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {confirmStatusUser.accountStatus === 'active'
                    ? `Suspend access for ${confirmStatusUser.name}? They will immediately lose workspace access.`
                    : `Restore workspace access for ${confirmStatusUser.name}?`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setConfirmStatusUser(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={confirmToggleStatus}
                className={`px-3.5 py-1.5 text-white rounded-lg font-semibold disabled:opacity-50 ${
                  confirmStatusUser.accountStatus === 'active'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {loading
                  ? 'Processing...'
                  : confirmStatusUser.accountStatus === 'active'
                  ? 'Suspend Account'
                  : 'Reactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete User Modal */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete User Profile</h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Remove Firestore workspace profile for <strong>{confirmDeleteUser.name}</strong> ({confirmDeleteUser.email})? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold"
              >
                {loading ? 'Deleting...' : 'Delete Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Administrator-Created Account Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {createdCredentials ? 'Team Account Created' : 'Create Team User Account'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {createdCredentials
                    ? 'Copy and share the initial login password securely with this employee.'
                    : 'Provisions an active Firebase Email & Password account without requiring email delivery.'}
                </p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdCredentials ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>{createdCredentials.name} is ready to log in</span>
                  </div>
                  <div className="space-y-1 text-emerald-900">
                    <div>
                      <span className="text-emerald-700">Email:</span>{' '}
                      <span className="font-mono font-semibold">{createdCredentials.email}</span>
                    </div>
                    {createdCredentials.employeeId && (
                      <div>
                        <span className="text-emerald-700">Employee ID:</span>{' '}
                        <span className="font-mono-tabular font-semibold">{createdCredentials.employeeId}</span>
                      </div>
                    )}
                  </div>

                  {createdCredentials.initialPassword && (
                    <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                          One-Time Initial Password
                        </span>
                        <span className="font-mono-tabular font-bold text-slate-900 break-all">
                          {createdCredentials.initialPassword}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyInitialPassword}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 shrink-0"
                      >
                        {copiedPassword ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}

                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    For security, passwords are never stored in Firestore and will not be shown again. Ask the employee to update their password in Settings &rarr; Authentication after signing in.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {createError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                        placeholder="Alex"
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        placeholder="Rivera"
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="member@company.com"
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Employee ID <span className="font-normal text-slate-400">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        value={newEmployeeId}
                        onChange={(e) => setNewEmployeeId(e.target.value)}
                        placeholder="EMP-1042"
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Department</label>
                      <select
                        value={newDeptId || ''}
                        onChange={(e) => setNewDeptId(e.target.value ? e.target.value : null)}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900"
                      >
                        <option value="">Unassigned</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Position</label>
                      <select
                        value={newPosId || ''}
                        onChange={(e) => setNewPosId(e.target.value ? e.target.value : null)}
                        className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900"
                      >
                        <option value="">Unassigned</option>
                        {positions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} (Level {p.level})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Assigned Roles</label>
                    <div className="grid grid-cols-2 gap-2">
                      {roles.map((r) => {
                        const isSelected = newRoleIds.includes(r.id);
                        const restricted = r.id === 'role_super_admin' && !isSuperAdmin;
                        return (
                          <button
                            type="button"
                            key={r.id}
                            disabled={restricted}
                            onClick={() => toggleNewRoleSelection(r.id)}
                            className={`p-2 rounded-lg border text-left transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            } disabled:opacity-40`}
                          >
                            <span className="font-semibold">{r.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block font-semibold text-slate-800">
                        Initial Password *
                      </label>
                      <button
                        type="button"
                        onClick={() => setInitialPassword(generateStrongInitialPassword())}
                        className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generate Strong Password</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showInitialPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={initialPassword}
                        onChange={(e) => setInitialPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowInitialPassword((v) => !v)}
                        className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                        title={showInitialPassword ? 'Hide password' : 'Show password'}
                      >
                        {showInitialPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      The initial password will be shown once after creation so you can share it directly with the team member.
                    </p>
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
                      disabled={createLoading}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                    >
                      {createLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{createLoading ? 'Creating Account...' : 'Create User Account'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
