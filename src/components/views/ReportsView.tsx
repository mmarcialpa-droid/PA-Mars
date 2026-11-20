import React, { useState } from 'react';
import { BarChart3, Clock, CheckCircle2, ShieldCheck, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ReportsView: React.FC = () => {
  const { tasks, projects, users, getProjectStats } = useApp();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const filteredTasks =
    selectedProjectId === 'all' ? tasks : tasks.filter((t) => t.projectId === selectedProjectId);

  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');

  const calcAvg = (values: number[]): number | null => {
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  };

  const avgCreationToStart = calcAvg(
    filteredTasks
      .map((t) => t.tatMetrics?.creationToStartHours)
      .filter((v): v is number => v !== undefined)
  );

  const avgStartToSubmit = calcAvg(
    filteredTasks
      .map((t) => t.tatMetrics?.startToFirstSubmissionHours)
      .filter((v): v is number => v !== undefined)
  );

  const avgRevisionTAT = calcAvg(
    filteredTasks
      .map((t) => t.tatMetrics?.revisionDurationHours)
      .filter((v): v is number => v !== undefined)
  );

  const avgApprovalTAT = calcAvg(
    filteredTasks
      .map((t) => t.tatMetrics?.approvalTurnaroundHours)
      .filter((v): v is number => v !== undefined)
  );

  const avgTotalTAT = calcAvg(
    completedTasks
      .map((t) => t.tatMetrics?.totalCompletionHours)
      .filter((v): v is number => v !== undefined)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-slate-900" />
            <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
              Turnaround Time (TAT) & Performance Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time tracking of task lifecycle durations, revision turnaround, approver review speed, and delivery SLAs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filter Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 outline-hidden focus:border-slate-400"
          >
            <option value="all">All Projects Combined</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary TAT Metric Scorecards (Strict Real Data Only) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Creation → Start</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-display text-slate-900 font-mono-tabular">
            {avgCreationToStart !== null ? `${avgCreationToStart}h` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {avgCreationToStart !== null ? 'Average response before work starts' : 'No data yet'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Start → First Submit</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-display text-slate-900 font-mono-tabular">
            {avgStartToSubmit !== null ? `${avgStartToSubmit}h` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {avgStartToSubmit !== null ? 'Initial deliverable drafting duration' : 'No data yet'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Revision Turnaround</span>
            <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold font-display text-orange-600 font-mono-tabular">
            {avgRevisionTAT !== null ? `${avgRevisionTAT}h` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {avgRevisionTAT !== null ? 'Revision request → resubmission' : 'No data yet'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Approval Turnaround</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-display text-amber-600 font-mono-tabular">
            {avgApprovalTAT !== null ? `${avgApprovalTAT}h` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {avgApprovalTAT !== null ? 'Approver review & decision speed' : 'No data yet'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Total Completion</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-display text-emerald-600 font-mono-tabular">
            {avgTotalTAT !== null ? `${avgTotalTAT}h` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {avgTotalTAT !== null ? 'End-to-end delivery cycle time' : 'No data yet'}
          </p>
        </div>
      </div>

      {/* Project Completion Progress Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Project Completion & Task Distribution Matrix
        </h2>

        {projects.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No projects available yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map((p) => {
              const stats = getProjectStats(p.id);
              return (
                <div key={p.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-bold text-slate-900">{p.name}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500 font-mono-tabular">{stats.totalTasks} total tasks</span>
                    </div>

                    <div className="flex items-center gap-4 text-slate-500 font-mono-tabular text-[11px]">
                      <span>{stats.completedTasks} completed</span>
                      <span>{stats.forApprovalTasks} in review</span>
                      <span>
                        {stats.overdueTasks > 0 ? (
                          <strong className="text-rose-600">{stats.overdueTasks} overdue</strong>
                        ) : (
                          '0 overdue'
                        )}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">{stats.completionPercentage}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${stats.completionPercentage}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Workload & Reviewer Distribution */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Team Workload & Role Allocations
        </h2>

        {users.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No active team members found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => {
              const userTasks = tasks.filter((t) => t.assignedUserIds.includes(u.id));
              const openTasks = userTasks.filter((t) => t.status !== 'completed');
              const completedCount = userTasks.filter((t) => t.status === 'completed').length;

              return (
                <div key={u.id} className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-lg text-xs space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{u.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{u.title || 'Team Member'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-center font-mono-tabular">
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Open Tasks</span>
                      <span className="font-bold text-slate-900">{openTasks.length}</span>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Completed</span>
                      <span className="font-bold text-emerald-600">{completedCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
