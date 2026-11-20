import React from 'react';
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  Briefcase, 
  Key, 
  Mail, 
  History, 
  Settings, 
  Network, 
  Sparkles,
  ArrowRight,
  Shield,
  Server,
  Lock,
  UserCheck
} from 'lucide-react';
import { useApp, AdminSection } from '../../context/AppContext';
import { DepartmentManager } from './DepartmentManager';
import { PositionManager } from './PositionManager';
import { RolePermissionMatrix } from './RolePermissionMatrix';
import { UserManager } from './UserManager';
import { RegistrationRequestsManager } from './RegistrationRequestsManager';
import { InvitationManager } from './InvitationManager';
import { AuditLogViewer } from './AuditLogViewer';
import { OrgSettings } from './OrgSettings';
import { EmailConfigurationPanel } from './EmailConfigurationPanel';
import { AuthPolicyPanel } from './AuthPolicyPanel';

export const AdminHub: React.FC = () => {
  const { 
    organization, 
    departments, 
    positions, 
    roles, 
    allUsers, 
    invitations, 
    passwordRecoveryRequests,
    auditLogs, 
    activeAdminSection, 
    setActiveAdminSection,
    isSuperAdmin,
    isAdmin,
    setIsOrgChartOpen
  } = useApp();

  const pendingRegistrationsCount =
    allUsers.filter((u) => ['pending_approval', 'invited'].includes(u.accountStatus)).length +
    passwordRecoveryRequests.filter((r) => r.status === 'pending').length;

  const tabs: { id: AdminSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'users', label: 'Team Users', icon: <Users className="w-4 h-4" />, badge: allUsers.length },
    { id: 'registrations', label: 'Registration Requests', icon: <UserCheck className="w-4 h-4" />, badge: pendingRegistrationsCount },
    { id: 'departments', label: 'Departments', icon: <Building2 className="w-4 h-4" />, badge: departments.length },
    { id: 'positions', label: 'Positions', icon: <Briefcase className="w-4 h-4" />, badge: positions.length },
    { id: 'roles', label: 'Roles & Matrix', icon: <Key className="w-4 h-4" />, badge: roles.length },
    { id: 'invitations', label: 'Invitations', icon: <Mail className="w-4 h-4" />, badge: invitations.filter(i => ['pending', 'sending', 'sent', 'failed'].includes(i.status)).length },
    { id: 'auth_policy', label: 'Authentication Policy', icon: <Lock className="w-4 h-4" /> },
    { id: 'email_settings', label: 'Email Configuration', icon: <Server className="w-4 h-4" /> },
    { id: 'audit_logs', label: 'Audit Trail', icon: <History className="w-4 h-4" /> },
    { id: 'org_settings', label: 'Organization Settings', icon: <Settings className="w-4 h-4" /> }
  ];

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <Shield className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Restricted Administration Access</h2>
        <p className="text-xs text-slate-500">
          This hub is restricted to Super Administrators and Administrators. Please contact your company administrator to request elevated permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Quick Org Chart Trigger */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-display text-slate-900 tracking-tight">
                  Organizational Administration Hub
                </h1>
                <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                  {isSuperAdmin ? 'Super Administrator' : 'Administrator'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {organization?.name || 'MARS'} · {organization?.timezone || 'America/New_York'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOrgChartOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <Network className="w-3.5 h-3.5 text-purple-600" />
              <span>Interactive Org Chart</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto mt-6 pt-2 border-t border-slate-100">
          {tabs.map(tab => {
            const isSelected = activeAdminSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveAdminSection(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="min-h-[500px]">
        {activeAdminSection === 'overview' && (
          <div className="space-y-6">
            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <span className="text-xs text-slate-500 block">Total Active Users</span>
                <span className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1 block">
                  {allUsers.filter(u => u.accountStatus === 'active').length}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {allUsers.filter(u => u.accountStatus === 'suspended').length} suspended
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <span className="text-xs text-slate-500 block">Departments</span>
                <span className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1 block">
                  {departments.length}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {departments.filter(d => !d.parentDepartmentId).length} root departments
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <span className="text-xs text-slate-500 block">Positions & Tiers</span>
                <span className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1 block">
                  {positions.length}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Levels 1 to 10
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <span className="text-xs text-slate-500 block">Open Invitations</span>
                <span className="text-2xl font-bold text-amber-600 font-mono-tabular mt-1 block">
                  {invitations.filter(i => ['pending', 'sending', 'sent'].includes(i.status)).length}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {invitations.filter(i => i.status === 'accepted').length} accepted · {invitations.filter(i => i.status === 'failed').length} failed
                </span>
              </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => setActiveAdminSection('departments')}
                className="bg-white border border-slate-200/90 rounded-xl p-5 hover:border-slate-300 hover:shadow-xs cursor-pointer transition-all space-y-2 text-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Manage Departments</h3>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Define business units, sub-departments, and assign department heads.
                </p>
                <div className="pt-2 text-blue-600 font-semibold flex items-center gap-1">
                  <span>Open Departments</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              <div
                onClick={() => setActiveAdminSection('positions')}
                className="bg-white border border-slate-200/90 rounded-xl p-5 hover:border-slate-300 hover:shadow-xs cursor-pointer transition-all space-y-2 text-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Positions & Hierarchy</h3>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Establish supervisory relationships with built-in circular reporting protection.
                </p>
                <div className="pt-2 text-purple-600 font-semibold flex items-center gap-1">
                  <span>Open Positions</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              <div
                onClick={() => setActiveAdminSection('roles')}
                className="bg-white border border-slate-200/90 rounded-xl p-5 hover:border-slate-300 hover:shadow-xs cursor-pointer transition-all space-y-2 text-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Roles & Permissions</h3>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Configure granular permissions across 8 organizational and project domains.
                </p>
                <div className="pt-2 text-amber-600 font-semibold flex items-center gap-1">
                  <span>Open Matrix</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Recent Audit Events preview */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-600" />
                  Recent Administrative Actions
                </h3>
                <button
                  onClick={() => setActiveAdminSection('audit_logs')}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  View Full Audit Trail
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No administrative actions logged yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {auditLogs.slice(0, 5).map(log => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.actorName}</span>
                        <span className="text-slate-500">
                          {log.action.replace('_', ' ')} on {log.targetType} "{log.targetTitle}"
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(log.timestamp || log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeAdminSection === 'users' && <UserManager />}
        {activeAdminSection === 'registrations' && <RegistrationRequestsManager />}
        {activeAdminSection === 'departments' && <DepartmentManager />}
        {activeAdminSection === 'positions' && <PositionManager />}
        {activeAdminSection === 'roles' && <RolePermissionMatrix />}
        {activeAdminSection === 'invitations' && <InvitationManager />}
        {activeAdminSection === 'auth_policy' && <AuthPolicyPanel />}
        {activeAdminSection === 'email_settings' && <EmailConfigurationPanel />}
        {activeAdminSection === 'audit_logs' && <AuditLogViewer />}
        {activeAdminSection === 'org_settings' && <OrgSettings />}
      </div>
    </div>
  );
};
