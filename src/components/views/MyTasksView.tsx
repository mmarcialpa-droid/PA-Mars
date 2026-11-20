import React, { useState } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Calendar, 
  Tag, 
  Clock, 
  Play, 
  CheckCircle2, 
  ArrowRight,
  Filter
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskStatus, TaskPriority } from '../../types';

export const MyTasksView: React.FC = () => {
  const { 
    tasks, 
    projects, 
    currentUser, 
    setSelectedTaskId, 
    startTask, 
    moveTaskStatus,
    setIsQuickCreateOpen,
    setQuickCreateType
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('open');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const myTasks = tasks.filter(t => {
    if (!currentUser || !t.assignedUserIds.includes(currentUser.id)) return false;
    if (statusFilter === 'open' && t.status === 'completed') return false;
    if (statusFilter === 'completed' && t.status !== 'completed') return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
            My Tasks & Responsibilities
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            All tasks across projects assigned to <strong>{currentUser?.name || 'You'}</strong>.
          </p>
        </div>

        <button
          onClick={() => {
            setQuickCreateType('task');
            setIsQuickCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Task</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === 'open' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Open ({currentUser ? tasks.filter(t => t.assignedUserIds.includes(currentUser.id) && t.status !== 'completed').length : 0})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === 'completed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed ({currentUser ? tasks.filter(t => t.assignedUserIds.includes(currentUser.id) && t.status === 'completed').length : 0})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Assigned
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-hidden"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
        {myTasks.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No tasks match this filter.
          </div>
        ) : (
          myTasks.map(task => {
            const proj = projects.find(p => p.id === task.projectId);
            const isOverdue = task.dueDate < today && task.status !== 'completed';

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className="p-4 hover:bg-slate-50/70 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" 
                      style={{ backgroundColor: proj?.color || '#0284c7' }} 
                    />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-slate-900 truncate ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                        {task.title}
                      </span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-semibold ${
                        task.status === 'for_approval' ? 'bg-amber-100 text-amber-800' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        task.status === 'for_revision' ? 'bg-orange-100 text-orange-800' :
                        task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                      <span className="font-medium text-slate-700">{proj?.name}</span>
                      <span>·</span>
                      <span className={`font-mono-tabular ${isOverdue ? 'text-rose-600 font-bold' : ''}`}>
                        Due: {task.dueDate} {isOverdue && '(Overdue)'}
                      </span>
                      <span>·</span>
                      <span>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} checklist items</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {task.status === 'todo' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startTask(task.id);
                      }}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-semibold text-xs flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      <span>Start</span>
                    </button>
                  )}

                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
