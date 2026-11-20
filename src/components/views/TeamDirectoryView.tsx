import React from 'react';
import { Users, Mail, Building2, Briefcase, Shield, Network } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TeamDirectoryView: React.FC = () => {
  const { allUsers, departments, positions, roles, tasks, setIsOrgChartOpen } = useApp();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
            Team Directory ({allUsers.length})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authorized organization members, departmental affiliations, and corporate hierarchy.
          </p>
        </div>

        <button
          onClick={() => setIsOrgChartOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs"
        >
          <Network className="w-3.5 h-3.5 text-purple-600" />
          <span>View Org Chart</span>
        </button>
      </div>

      {/* Grid of Users */}
      {allUsers.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No members in directory yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Issue employee invitations from the Administration Hub to populate the directory.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {allUsers.map(user => {
            const dept = departments.find(d => d.id === user.departmentId);
            const pos = positions.find(p => p.id === user.positionId);
            const userRoles = roles.filter(r => (user.roleIds || []).includes(r.id));
            const assignedTasks = tasks.filter(t => t.assignedUserIds.includes(user.id));
            const openTasks = assignedTasks.filter(t => t.status !== 'completed');

            return (
              <div
                key={user.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:border-slate-300 transition-colors space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex flex-wrap gap-1 justify-end">
                      {userRoles.map(r => (
                        <span
                          key={r.id}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.id === 'role_super_admin'
                              ? 'bg-amber-100 text-amber-900'
                              : r.id === 'role_admin'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-bold text-sm text-slate-900">{user.name}</h3>
                    <p className="text-xs text-slate-600 font-medium">
                      {pos ? `${pos.title} (Level ${pos.level})` : 'Position Unassigned'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {dept?.name || 'Department Unassigned'}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate font-mono text-[11px]">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono-tabular">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span>{openTasks.length} active tasks assigned</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="capitalize text-[11px]">
                    Status: <strong className="text-slate-700">{user.accountStatus}</strong>
                  </span>
                  <span className="text-[10px] font-mono">
                    Joined {user.dateJoined || 'Recently'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
