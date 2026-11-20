import React, { useMemo, useState } from 'react';
import {
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  Archive,
  UserX,
  Trash2,
  Ticket,
  Globe,
  Building2,
  X,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PasswordRecoveryRequest, User } from '../../types';

type SectionTab = 'registrations' | 'recovery';
type QueueFilter = 'pending' | 'rejected' | 'archived' | 'all';
type RecoveryFilter = 'pending' | 'resolved' | 'all';

export const RegistrationRequestsManager: React.FC = () => {
  const {
    allUsers,
    registrationRequests,
    passwordRecoveryRequests,
    departments,
    positions,
    roles,
    authPolicy,
    currentUser,
    isSuperAdmin,
    setActiveAdminSection,
    approveRegistrationRequest,
    rejectRegistrationRequest,
    suspendUser,
    archiveUserAccount,
    deleteUserAccount,
    resolvePasswordRecoveryRequest,
    showToast
  } = useApp();

  const [sectionTab, setSectionTab] = useState<SectionTab>('registrations');
  const [filter, setFilter] = useState<QueueFilter>('pending');
  const [recoveryFilter, setRecoveryFilter] = useState<RecoveryFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Approve & Assign modal state
  const [approveTarget, setApproveTarget] = useState<User | null>(null);
  const [assignDeptId, setAssignDeptId] = useState<string | null>(null);
  const [assignPosId, setAssignPosId] = useState<string | null>(null);
  const [assignManagerId, setAssignManagerId] = useState<string | null>(null);
  const [assignRoleIds, setAssignRoleIds] = useState<string[]>(['role_member']);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Delete profile confirm state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // Resolve Password Recovery modal state
  const [recoveryTarget, setRecoveryTarget] = useState<PasswordRecoveryRequest | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<'approved' | 'resolved' | 'dismissed'>('resolved');
  const [recoveryResolutionNote, setRecoveryResolutionNote] = useState('');

  const pendingStatuses = new Set(['pending_approval', 'pending_verification', 'invited']);

  const requestByUserId = useMemo(() => {
    const map = new Map<string, (typeof registrationRequests)[number]>();
    for (const req of registrationRequests) {
      map.set(req.userId, req);
    }
    return map;
  }, [registrationRequests]);

  const counts = useMemo(() => {
    const nonSuperUsers = allUsers.filter((u) => !(u.roleIds || []).includes('role_super_admin'));
    return {
      pending: nonSuperUsers.filter((u) => pendingStatuses.has(u.accountStatus)).length,
      rejected: nonSuperUsers.filter((u) => u.accountStatus === 'rejected').length,
      archived: nonSuperUsers.filter((u) => u.accountStatus === 'archived').length,
      all: nonSuperUsers.length
    };
  }, [allUsers]);

  const recoveryCounts = useMemo(() => {
    return {
      pending: passwordRecoveryRequests.filter((r) => r.status === 'pending').length,
      resolved: passwordRecoveryRequests.filter((r) => r.status !== 'pending').length,
      all: passwordRecoveryRequests.length
    };
  }, [passwordRecoveryRequests]);

  const filteredUsers = useMemo(() => {
    return allUsers
      .filter((u) => !(u.roleIds || []).includes('role_super_admin'))
      .filter((u) => {
        if (filter === 'pending') return pendingStatuses.has(u.accountStatus);
        if (filter === 'rejected') return u.accountStatus === 'rejected';
        if (filter === 'archived') return u.accountStatus === 'archived';
        return true;
      })
      .filter((u) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.employeeId || '').toLowerCase().includes(q) ||
          (u.requestedDepartment || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [allUsers, filter, searchQuery]);

  const filteredRecoveryRequests = useMemo(() => {
    return passwordRecoveryRequests
      .filter((req) => {
        if (recoveryFilter === 'pending') return req.status === 'pending';
        if (recoveryFilter === 'resolved') return req.status !== 'pending';
        return true;
      })
      .filter((req) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          req.email.toLowerCase().includes(q) ||
          (req.employeeId || '').toLowerCase().includes(q) ||
          (req.userName || '').toLowerCase().includes(q) ||
          (req.note || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [passwordRecoveryRequests, recoveryFilter, searchQuery]);

  const activeManagers = useMemo(
    () => allUsers.filter((u) => u.accountStatus === 'active'),
    [allUsers]
  );

  const openApproveModal = (user: User) => {
    setApproveTarget(user);
    let initialDept = user.departmentId || null;
    if (!initialDept && user.requestedDepartment) {
      const reqLower = user.requestedDepartment.trim().toLowerCase();
      const matched = departments.find((d) => d.name.toLowerCase() === reqLower);
      if (matched) initialDept = matched.id;
    }
    setAssignDeptId(initialDept);
    setAssignPosId(user.positionId || null);
    setAssignManagerId(user.managerId || null);
    setAssignRoleIds(user.roleIds && user.roleIds.length > 0 ? user.roleIds : ['role_member']);
    setModalError(null);
  };

  const toggleAssignRole = (roleId: string) => {
    if (roleId === 'role_super_admin' && !isSuperAdmin) return;
    if (assignRoleIds.includes(roleId)) {
      if (assignRoleIds.length === 1) return;
      setAssignRoleIds((prev) => prev.filter((id) => id !== roleId));
    } else {
      setAssignRoleIds((prev) => [...prev, roleId]);
    }
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTarget) return;
    setActionLoading(true);
    setModalError(null);
    try {
      await approveRegistrationRequest(approveTarget.id, {
        departmentId: assignDeptId,
        positionId: assignPosId,
        managerId: assignManagerId,
        roleIds: assignRoleIds
      });
      setApproveTarget(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to approve registration.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setActionLoading(true);
    setModalError(null);
    try {
      await rejectRegistrationRequest(rejectTarget.id, rejectionReason);
      setRejectTarget(null);
      setRejectionReason('');
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to reject registration.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    setModalError(null);
    try {
      await deleteUserAccount(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to delete user profile.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmResolveRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryTarget) return;
    setActionLoading(true);
    setModalError(null);
    try {
      await resolvePasswordRecoveryRequest(recoveryTarget.id, {
        status: recoveryStatus,
        resolutionNote: recoveryResolutionNote.trim() || null
      });
      setRecoveryTarget(null);
      setRecoveryResolutionNote('');
    } catch (err: unknown) {
      setModalError(
        err instanceof Error ? err.message : 'Failed to update password recovery request.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendOrArchive = async (user: User, action: 'suspend' | 'archive') => {
    if (user.id === currentUser?.id) {
      showToast('error', 'You cannot modify your own active session status.');
      return;
    }
    try {
      if (action === 'suspend') {
        await suspendUser(user.id);
      } else {
        await archiveUserAccount(user.id);
      }
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update user status.');
    }
  };

  const formatDate = (raw?: string | null) => {
    if (!raw) return '—';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const policyLabel =
    authPolicy.registrationPolicy === 'public_registration'
      ? 'Open Registration'
      : authPolicy.registrationPolicy === 'admin_created'
      ? 'Administrator-Created Only'
      : 'Invitation-Only Registration';

  return (
    <div className="space-y-5">
      {/* Header & Active Policy Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-700" />
            <span>Registration &amp; Account Recovery Queue</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Approve or reject new signups, assign departments and roles, and verify administrator-assisted password recovery requests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveAdminSection('auth_policy')}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shrink-0 self-start sm:self-auto"
        >
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Mode: {policyLabel}</span>
        </button>
      </div>

      {/* Primary Section Switcher */}
      <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setSectionTab('registrations')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            sectionTab === 'registrations'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Account Registrations</span>
          {counts.pending > 0 && (
            <span className="font-mono-tabular text-[11px] font-bold text-amber-700">
              ({counts.pending})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSectionTab('recovery')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            sectionTab === 'recovery'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Password Recovery Requests</span>
          {recoveryCounts.pending > 0 && (
            <span className="font-mono-tabular text-[11px] font-bold text-rose-700">
              ({recoveryCounts.pending})
            </span>
          )}
        </button>
      </div>

      {sectionTab === 'registrations' ? (
        <>
          {/* Registration Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
              {(
                [
                  { id: 'pending', label: 'Pending Review', count: counts.pending },
                  { id: 'rejected', label: 'Rejected', count: counts.rejected },
                  { id: 'archived', label: 'Archived', count: counts.archived },
                  { id: 'all', label: 'All Registrations', count: counts.all }
                ] as { id: QueueFilter; label: string; count: number }[]
              ).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`font-mono-tabular text-[11px] ${
                        active ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, employee ID..."
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 w-full sm:w-64"
              />
            </div>
          </div>

          {/* Registration Table */}
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
              <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">
                {filter === 'pending' ? 'No pending registration requests' : 'No matching records'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {filter === 'pending'
                  ? 'All signups have been reviewed or approved.'
                  : 'Try adjusting your status filter or search query.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Registered</th>
                      <th className="py-3 px-4">Signup Method</th>
                      <th className="py-3 px-4">Requested Dept</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => {
                      const reqMeta = requestByUserId.get(user.id);
                      const hasInvitation = Boolean(
                        user.invitedTokenHash || reqMeta?.registrationMethod === 'invitation'
                      );
                      const assignedDept = departments.find((d) => d.id === user.departmentId);
                      const displayEmpId = user.employeeId || reqMeta?.employeeId;

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <div className="font-bold text-slate-900">{user.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-mono-tabular text-[11px] text-slate-600">
                            {displayEmpId || <span className="text-slate-400">—</span>}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium font-mono-tabular">
                            {formatDate(user.createdAt || user.dateJoined)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {hasInvitation ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700">
                                <Ticket className="w-3 h-3" />
                                <span>Invited</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                                <Globe className="w-3 h-3" />
                                <span>Open Signup</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {assignedDept ? (
                              <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                <span>{assignedDept.name}</span>
                              </span>
                            ) : user.requestedDepartment ? (
                              <span className="inline-flex items-center gap-1 text-slate-700 text-[11px]">
                                <Building2 className="w-3 h-3 text-amber-600" />
                                <span>{user.requestedDepartment}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-semibold capitalize ${
                                user.accountStatus === 'active'
                                  ? 'text-emerald-700'
                                  : user.accountStatus === 'pending_approval'
                                  ? 'text-amber-700'
                                  : user.accountStatus === 'archived'
                                  ? 'text-slate-600'
                                  : 'text-rose-700'
                              }`}
                            >
                              {(user.accountStatus || 'active').replace(/_/g, ' ')}
                            </span>
                            {user.accountStatus === 'rejected' && user.rejectionReason && (
                              <div
                                className="text-[10px] text-rose-600 mt-0.5 max-w-[180px] truncate"
                                title={user.rejectionReason}
                              >
                                {user.rejectionReason}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {user.accountStatus !== 'active' && (
                                <button
                                  type="button"
                                  onClick={() => openApproveModal(user)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold shadow-2xs"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Approve &amp; Assign</span>
                                </button>
                              )}

                              {user.accountStatus !== 'rejected' && user.accountStatus !== 'archived' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectTarget(user);
                                    setRejectionReason('');
                                    setModalError(null);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-md text-[11px] font-semibold"
                                  title="Reject Registration"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              )}

                              {user.accountStatus === 'active' && (
                                <button
                                  type="button"
                                  onClick={() => handleSuspendOrArchive(user, 'suspend')}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                                  title="Suspend Account"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {user.accountStatus !== 'archived' && (
                                <button
                                  type="button"
                                  onClick={() => handleSuspendOrArchive(user, 'archive')}
                                  className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                                  title="Archive Account"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {user.id !== currentUser?.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteTarget(user);
                                    setModalError(null);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                                  title="Delete Profile"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Password Recovery Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
              {(
                [
                  { id: 'pending', label: 'Pending Review', count: recoveryCounts.pending },
                  { id: 'resolved', label: 'Completed / Dismissed', count: recoveryCounts.resolved },
                  { id: 'all', label: 'All Requests', count: recoveryCounts.all }
                ] as { id: RecoveryFilter; label: string; count: number }[]
              ).map((tab) => {
                const active = recoveryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRecoveryFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`font-mono-tabular text-[11px] ${
                        active ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search email, employee ID, note..."
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 w-full sm:w-64"
              />
            </div>
          </div>

          {filteredRecoveryRequests.length === 0 ? (
            <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
              <KeyRound className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">
                {recoveryFilter === 'pending'
                  ? 'No pending password recovery requests'
                  : 'No recovery requests found'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                When users request assistance via Forgot Password on the login page, their requests appear here for administrator verification.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="divide-y divide-slate-100">
                {filteredRecoveryRequests.map((req) => {
                  const matchedUser = allUsers.find(
                    (u) => u.email.toLowerCase() === req.email.toLowerCase()
                  );
                  return (
                    <div
                      key={req.id}
                      className="p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 font-mono">{req.email}</span>
                          {matchedUser && (
                            <span className="text-slate-600">· {matchedUser.name}</span>
                          )}
                          {req.employeeId && (
                            <span className="font-mono-tabular text-[11px] text-slate-500">
                              · ID: {req.employeeId}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-semibold capitalize ${
                              req.status === 'pending'
                                ? 'text-amber-700'
                                : req.status === 'dismissed'
                                ? 'text-slate-500'
                                : 'text-emerald-700'
                            }`}
                          >
                            · {req.status}
                          </span>
                        </div>
                        {req.note && (
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            User Note: {req.note}
                          </p>
                        )}
                        <div className="text-[11px] text-slate-400 font-mono-tabular flex flex-wrap gap-2">
                          <span>Submitted {new Date(req.createdAt).toLocaleString()}</span>
                          {req.resolvedAt && (
                            <span>
                              · Reviewed {new Date(req.resolvedAt).toLocaleString()}
                              {req.resolvedByName ? ` by ${req.resolvedByName}` : ''}
                            </span>
                          )}
                        </div>
                        {req.resolutionNote && (
                          <p className="text-[11px] text-slate-600">
                            Resolution: {req.resolutionNote}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryTarget(req);
                            setRecoveryStatus(req.status === 'pending' ? 'resolved' : req.status);
                            setRecoveryResolutionNote(req.resolutionNote || '');
                            setModalError(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            req.status === 'pending'
                              ? 'bg-slate-900 hover:bg-slate-800 text-white'
                              : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {req.status === 'pending' ? 'Verify & Resolve' : 'Update Note'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Approve & Organizational Assignment Modal */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Approve Registration: {approveTarget.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {approveTarget.email}
                  {approveTarget.employeeId ? ` · ID: ${approveTarget.employeeId}` : ''}
                  {approveTarget.requestedDepartment ? ` · Requested Dept: ${approveTarget.requestedDepartment}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmApprove} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign Department</label>
                  <select
                    value={assignDeptId || ''}
                    onChange={(e) => setAssignDeptId(e.target.value || null)}
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
                  <label className="block font-semibold text-slate-700 mb-1">Assign Position</label>
                  <select
                    value={assignPosId || ''}
                    onChange={(e) => setAssignPosId(e.target.value || null)}
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="">Unassigned</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (L{p.level})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Reporting Manager</label>
                <select
                  value={assignManagerId || ''}
                  onChange={(e) => setAssignManagerId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="">No Reporting Manager</option>
                  {activeManagers
                    .filter((m) => m.id !== approveTarget.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Assign System Role(s)</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const selected = assignRoleIds.includes(r.id);
                    const restricted = r.id === 'role_super_admin' && !isSuperAdmin;
                    return (
                      <button
                        type="button"
                        key={r.id}
                        disabled={restricted}
                        onClick={() => toggleAssignRole(r.id)}
                        className={`p-2 rounded-lg border text-left transition-colors flex items-center justify-between ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        } disabled:opacity-40`}
                      >
                        <span className="font-semibold">{r.name}</span>
                        {selected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Approving...' : 'Approve & Grant Access'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Registration Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Decline Registration Request
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {rejectTarget.name} ({rejectTarget.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Rejection <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={400}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Outside authorized organization domain or duplicate request."
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Declining...' : 'Reject Registration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Profile Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Workspace Profile</h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Remove Firestore profile and registration request for <strong>{deleteTarget.name}</strong> ({deleteTarget.email})? This cannot be undone.
                </p>
              </div>
            </div>
            {modalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {modalError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold"
              >
                {actionLoading ? 'Deleting...' : 'Delete Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Password Recovery Modal */}
      {recoveryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Resolve Password Recovery Request
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {recoveryTarget.email}
                  {recoveryTarget.employeeId ? ` · ID: ${recoveryTarget.employeeId}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecoveryTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleConfirmResolveRecovery} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Verification Decision
                </label>
                <select
                  value={recoveryStatus}
                  onChange={(e) =>
                    setRecoveryStatus(e.target.value as 'approved' | 'resolved' | 'dismissed')
                  }
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="approved">Approved — Identity Verified</option>
                  <option value="resolved">Resolved — Access Restored / New Account Provisioned</option>
                  <option value="dismissed">Dismissed — Unverified / Invalid Request</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Administrator Resolution Note
                </label>
                <textarea
                  rows={3}
                  maxLength={400}
                  value={recoveryResolutionNote}
                  onChange={(e) => setRecoveryResolutionNote(e.target.value)}
                  placeholder="Record verification method and action taken (never store passwords in notes)."
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecoveryTarget(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Saving...' : 'Save Decision'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
