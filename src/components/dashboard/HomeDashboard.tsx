import React from 'react';
import { 
  CheckSquare, 
  FolderKanban, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Calendar, 
  ArrowRight, 
  MessageSquare, 
  Plus, 
  CheckCircle2, 
  Play, 
  Users,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const HomeDashboard: React.FC = () => {
  const { 
    currentUser, 
    tasks, 
    projects, 
    discussions, 
    events, 
    activities, 
    users,
    setActiveProjectId, 
    setActiveProjectTab, 
    setSelectedTaskId,
    setActiveView,
    setIsQuickCreateOpen,
    setQuickCreateType,
    getProjectStats,
    startTask,
    isSuperAdmin,
    isAdmin,
    hasPermission,
    isApproverForProject
  } = useApp();

  const canOpenApprovalCenter = isSuperAdmin || isAdmin || hasPermission('view_approval_center') || hasPermission('approve_tasks');

  const today = new Date().toISOString().split('T')[0];

  // User tasks
  const myTasks = currentUser 
    ? tasks.filter(t => t.assignedUserIds.includes(currentUser.id) && t.status !== 'completed')
    : [];
  const myOverdueTasks = myTasks.filter(t => t.dueDate < today);
  const myPriorityTasks = myTasks.filter(t => t.priority === 'urgent' || t.priority === 'high');

  // Approvals queue
  const tasksAwaitingApproval = tasks.filter(t => t.status === 'for_approval');

  // Recent projects
  const activeProjects = projects.filter(p => p.status === 'active');

  // Upcoming events
  const upcomingEvents = [...events]
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  // Recent discussions
  const recentDiscussions = [...discussions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  // Recent activities
  const recentActivities = [...activities].slice(0, 6);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner & Executive Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
              Good day, {currentUser?.name ? currentUser.name.split(' ')[0] : 'Member'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {currentUser?.title || 'Team Member'} · {currentUser?.department || 'Organization'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setQuickCreateType('task');
                setIsQuickCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
            <button
              onClick={() => {
                setQuickCreateType('project');
                setIsQuickCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Compact KPI Row (tabular scannable figures) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">My Open Tasks</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-display text-slate-900 font-mono-tabular">
                {myTasks.length}
              </span>
              {myOverdueTasks.length > 0 && (
                <span className="text-[11px] font-semibold text-rose-600 font-mono-tabular">
                  ({myOverdueTasks.length} overdue)
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Tasks Awaiting Approval</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-display text-amber-600 font-mono-tabular">
                {tasksAwaitingApproval.length}
              </span>
              <span className="text-[11px] text-slate-400">across projects</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Active Projects</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-display text-slate-900 font-mono-tabular">
                {activeProjects.length}
              </span>
              <span className="text-[11px] text-slate-400">managed</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Upcoming Deadlines</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-display text-slate-900 font-mono-tabular">
                {upcomingEvents.length}
              </span>
              <span className="text-[11px] text-slate-400">this month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Workflow Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Work Queues & Projects (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* MARS Tasks Awaiting Approval Section */}
          {tasksAwaitingApproval.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Tasks Awaiting Approval ({tasksAwaitingApproval.length})
                  </h2>
                </div>
                {canOpenApprovalCenter && (
                  <button
                    onClick={() => setActiveView('approvals')}
                    className="text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
                  >
                    <span>Open Approval Center</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {tasksAwaitingApproval.map(task => {
                  const proj = projects.find(p => p.id === task.projectId);
                  const lastApproval = task.approvalHistory[task.approvalHistory.length - 1];
                  const submitter = users.find(u => u.id === lastApproval?.submittedBy);

                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/70 p-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate hover:text-blue-600">
                            {task.title}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Round {lastApproval?.round || 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          {proj?.name} · Submitted by {submitter?.name || 'Designer'}: "{lastApproval?.designerRemarks || 'Ready for review'}"
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTaskId(task.id);
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-2xs shrink-0"
                      >
                        {isApproverForProject(task.projectId) ? 'Review' : 'View'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* My Priorities & Upcoming Tasks */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
                My Assigned Tasks ({myTasks.length})
              </h2>
              <button
                onClick={() => setActiveView('my_tasks')}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {myTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                You have no open tasks assigned. Nice job!
              </div>
            ) : (
              <div className="space-y-2">
                {myTasks.slice(0, 5).map(task => {
                  const proj = projects.find(p => p.id === task.projectId);
                  const isOverdue = task.dueDate < today;

                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="p-3 border border-slate-200/80 rounded-lg hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 truncate">
                            {task.title}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            task.status === 'for_revision' ? 'bg-orange-100 text-orange-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span className="font-medium text-slate-700">{proj?.name}</span>
                          <span>·</span>
                          <span className={`font-mono-tabular ${isOverdue ? 'text-rose-600 font-semibold' : ''}`}>
                            Due {task.dueDate} {isOverdue && '(Overdue)'}
                          </span>
                          <span>·</span>
                          <span>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} checklist items</span>
                        </div>
                      </div>

                      {task.status === 'todo' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startTask(task.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                          title="Start working"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Projects Quick Access */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-slate-600" />
                Active Projects ({activeProjects.length})
              </h2>
              <button
                onClick={() => setActiveView('projects')}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1"
              >
                <span>View all projects</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5">
              {activeProjects.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No active projects yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Projects are the central workspace for team collaboration.</p>
                  <button
                    onClick={() => {
                      setQuickCreateType('project');
                      setIsQuickCreateOpen(true);
                    }}
                    className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Create First Project
                  </button>
                </div>
              ) : (
                activeProjects.map(project => {
                  const stats = getProjectStats(project.id);
                  return (
                    <div
                      key={project.id}
                      onClick={() => {
                        setActiveProjectId(project.id);
                        setActiveProjectTab('overview');
                      }}
                      className="p-3 border border-slate-200/80 rounded-lg hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                          <span className="truncate">{project.name}</span>
                        </div>
                        <span className="text-slate-500 font-mono-tabular shrink-0">
                          {stats.completionPercentage}% complete
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                        {project.description}
                      </p>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${stats.completionPercentage}%`, backgroundColor: project.color }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                        <span>{stats.totalTasks} tasks ({stats.completedTasks} completed)</span>
                        <span>Target: {project.targetDate}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Deadlines, Discussions & Activity (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming Deadlines & Schedule */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                Schedule & Milestones
              </h2>
              <button
                onClick={() => setActiveView('schedule')}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium"
              >
                Calendar
              </button>
            </div>

            <div className="space-y-2">
              {upcomingEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No upcoming events or milestones scheduled.
                </div>
              ) : (
                upcomingEvents.map(event => {
                  const proj = projects.find(p => p.id === event.projectId);
                  return (
                    <div key={event.id} className="p-2.5 bg-slate-50/70 border border-slate-200/70 rounded-lg text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 truncate">{event.title}</span>
                        <span className="text-[10px] font-mono-tabular font-medium text-slate-500 shrink-0">
                          {event.date}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>{proj?.name || 'General'}</span>
                        <span className="capitalize text-slate-400">{event.type}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Discussions */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                Recent Discussions
              </h2>
            </div>

            <div className="space-y-2">
              {recentDiscussions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No project discussions posted yet.
                </div>
              ) : (
                recentDiscussions.map(disc => {
                  const proj = projects.find(p => p.id === disc.projectId);
                  const author = users.find(u => u.id === disc.authorId);

                  return (
                    <div
                      key={disc.id}
                      onClick={() => {
                        setActiveProjectId(disc.projectId);
                        setActiveProjectTab('discussions');
                      }}
                      className="p-2.5 hover:bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer transition-colors text-xs"
                    >
                      <div className="font-semibold text-slate-900 truncate mb-0.5">
                        {disc.title}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mb-1">
                        {disc.content}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-tabular">
                        <span>{proj?.name} · By {author?.name || 'Member'}</span>
                        <span>{new Date(disc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              Recent Workspace Activity
            </h2>

            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No recent workspace activity yet.
                </div>
              ) : (
                recentActivities.map(act => {
                  const actor = users.find(u => u.id === act.userId);
                  return (
                    <div key={act.id} className="text-xs flex items-start gap-2">
                      <img 
                        src={actor?.avatar} 
                        alt={actor?.name} 
                        className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="text-slate-800 leading-snug">
                          <strong>{actor?.name || 'Team Member'}</strong> {act.details || act.action.replace('_', ' ')}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono-tabular">
                          {new Date(act.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
