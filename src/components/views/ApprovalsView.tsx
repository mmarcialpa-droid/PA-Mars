import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ApprovalsView: React.FC = () => {
  const {
    tasks,
    projects,
    users,
    setSelectedTaskId,
    approveTask,
    isApproverForProject
  } = useApp();

  const [filterStatus, setFilterStatus] = useState<'all' | 'for_approval' | 'for_revision' | 'completed'>('for_approval');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');

  const approvalTasks = tasks.filter((t) => {
    if (filterStatus === 'for_approval' && t.status !== 'for_approval') return false;
    if (filterStatus === 'for_revision' && t.status !== 'for_revision') return false;
    if (filterStatus === 'completed' && (t.status !== 'completed' || t.approvalHistory.length === 0)) return false;
    if (filterStatus === 'all' && t.approvalHistory.length === 0 && t.status !== 'for_approval') return false;
    if (selectedProjectFilter !== 'all' && t.projectId !== selectedProjectFilter) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-600" />
            <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
              MARS Task Approval Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized queue for reviewing submissions, inspecting deliverables, tracking revisions, and monitoring turnaround times.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('for_approval')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              filterStatus === 'for_approval' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Awaiting Review ({tasks.filter((t) => t.status === 'for_approval').length})
          </button>
          <button
            onClick={() => setFilterStatus('for_revision')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              filterStatus === 'for_revision' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            For Revision ({tasks.filter((t) => t.status === 'for_revision').length})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              filterStatus === 'completed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approved History
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-hidden"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Approval Task Cards */}
      <div className="space-y-4">
        {approvalTasks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-400">
            No submissions in this queue.
          </div>
        ) : (
          approvalTasks.map((task) => {
            const project = projects.find((p) => p.id === task.projectId);
            const lastRecord = task.approvalHistory[task.approvalHistory.length - 1];
            const submitter = users.find((u) => u.id === lastRecord?.submittedBy);
            const canReview = isApproverForProject(task.projectId);

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-2xs hover:shadow-xs cursor-pointer transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {project && (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    )}
                    <span className="text-xs font-medium text-slate-500">{project?.name}</span>
                    <span className="text-slate-300">/</span>
                    <h3 className="font-bold text-sm text-slate-900 hover:text-blue-600 transition-colors">
                      {task.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        task.status === 'for_approval'
                          ? 'bg-amber-100 text-amber-800'
                          : task.status === 'for_revision'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                    {lastRecord && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono-tabular font-semibold">
                        Round {lastRecord.round}
                      </span>
                    )}
                  </div>
                </div>

                {lastRecord && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Submitted by <strong>{submitter?.name || 'Designer'}</strong>
                      </span>
                      <span className="font-mono-tabular">
                        {new Date(lastRecord.submittedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <p className="text-slate-800 italic leading-relaxed">"{lastRecord.designerRemarks}"</p>

                    {lastRecord.revisionNotes && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px]">
                        <strong>Previous Revision Feedback:</strong> {lastRecord.revisionNotes}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-4 text-slate-500 font-mono-tabular text-[11px]">
                    <span>
                      Creation → Start: <strong>{task.tatMetrics?.creationToStartHours !== undefined ? `${task.tatMetrics.creationToStartHours}h` : '—'}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Start → Submit: <strong>{task.tatMetrics?.startToFirstSubmissionHours !== undefined ? `${task.tatMetrics.startToFirstSubmissionHours}h` : '—'}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Approval TAT: <strong>{task.tatMetrics?.approvalTurnaroundHours !== undefined ? `${task.tatMetrics.approvalTurnaroundHours}h` : '—'}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {canReview && task.status === 'for_approval' && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await approveTask(task.id);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskId(task.id);
                      }}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-2xs flex items-center gap-1"
                    >
                      {!canReview && task.status === 'for_approval' && <RotateCcw className="w-3 h-3 hidden" />}
                      <span>{canReview ? 'Inspect & Review' : 'View Submission'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
