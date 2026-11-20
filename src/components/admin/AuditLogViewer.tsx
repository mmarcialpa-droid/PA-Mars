import React, { useState } from 'react';
import { History, Shield, Filter, Search, User, Clock, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AuditLogViewer: React.FC = () => {
  const { auditLogs } = useApp();

  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = auditLogs.filter(log => {
    const matchesType = filterType === 'all' || log.targetType === filterType;
    const matchesSearch = 
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Security & Administration Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable chronological record of organizational modifications, role changes, and access permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 w-48"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
          >
            <option value="all">All Target Entities</option>
            <option value="organization">Organization</option>
            <option value="department">Departments</option>
            <option value="position">Positions</option>
            <option value="role">Roles & Permissions</option>
            <option value="user">Users</option>
            <option value="invitation">Invitations</option>
          </select>
        </div>
      </div>

      {/* Audit Log Timeline */}
      {filteredLogs.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
          <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No audit events recorded</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Administrative actions such as role creations, department edits, and user suspensions will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => {
              const formattedDate = new Date(log.timestamp || log.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });

              const detailsPayload = log.details || log.changes;

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-4 text-xs">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.actorName}</span>
                        <span className="text-[11px] text-slate-500">({log.actorEmail})</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-[10px] uppercase font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {log.action.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-slate-700 mt-1">
                        Modified <span className="font-semibold">{log.targetType}</span>: "{log.targetTitle}"
                      </p>

                      {detailsPayload && (
                        <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-200/60 font-mono text-[10px] text-slate-600 overflow-x-auto max-w-xl">
                          {typeof detailsPayload === 'object' ? JSON.stringify(detailsPayload) : String(detailsPayload)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3 text-slate-300" />
                      {formattedDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
