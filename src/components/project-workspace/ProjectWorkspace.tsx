import React, { useState } from 'react';
import {
  CheckSquare,
  MessageSquare,
  Files,
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  BarChart3,
  Plus,
  List,
  Columns3,
  Search,
  Pin,
  ArrowRight,
  ExternalLink,
  Trash2,
  Settings,
  X,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Archive
} from 'lucide-react';
import { useApp, ProjectTab } from '../../context/AppContext';
import { TaskStatus, ProjectStatus, ProjectVisibility } from '../../types';
import { CommentThread } from '../collaboration/CommentThread';

export const ProjectWorkspace: React.FC = () => {
  const {
    activeProject,
    activeProjectTab,
    setActiveProjectTab,
    tasks,
    discussions,
    files,
    events,
    activities,
    users,
    currentUser,
    projectMembers,
    getProjectStats,
    setSelectedTaskId,
    moveTaskStatus,
    togglePinDiscussion,
    deleteDiscussion,
    deleteFile,
    downloadFile,
    createEvent,
    deleteEvent,
    setIsQuickCreateOpen,
    setQuickCreateType,
    updateProject,
    archiveProject,
    addProjectMember,
    removeProjectMember,
    canManageProject,
    isApproverForProject,
    isAdmin,
    isSuperAdmin
  } = useApp();

  // Sub-view controls for To-Dos
  const [todoViewMode, setTodoViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Calendar month state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Discussion state
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);

  // Project Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editProjName, setEditProjName] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');
  const [editProjStatus, setEditProjStatus] = useState<ProjectStatus>('active');
  const [editProjVisibility, setEditProjVisibility] = useState<'public' | 'private' | 'department'>('public');
  const [editProjTargetDate, setEditProjTargetDate] = useState('');
  const [editProjColor, setEditProjColor] = useState('#0284c7');
  const [savingSettings, setSavingSettings] = useState(false);

  // Add Member state
  const [memberUserIdToAdd, setMemberUserIdToAdd] = useState('');
  const [memberRoleToAdd, setMemberRoleToAdd] = useState('member');
  const [addingMember, setAddingMember] = useState(false);

  // Project Schedule quick-add state
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('10:00 - 11:00');
  const [eventType, setEventType] = useState<'deadline' | 'milestone' | 'meeting' | 'review'>('milestone');

  if (!activeProject) return null;

  const stats = getProjectStats(activeProject.id);
  const projectTasks = tasks.filter((t) => t.projectId === activeProject.id);
  const projectDiscussions = discussions.filter((d) => d.projectId === activeProject.id);
  const projectFiles = files.filter((f) => f.projectId === activeProject.id);
  const projectEvents = events.filter((e) => e.projectId === activeProject.id);
  const projectActivities = activities.filter((a) => a.projectId === activeProject.id);
  const members = projectMembers[activeProject.id] || [];
  const memberUsers = users.filter((u) => members.some((m) => m.userId === u.id));
  const nonMemberUsers = users.filter((u) => !members.some((m) => m.userId === u.id));

  const canManage = canManageProject(activeProject);
  const isApprover = isApproverForProject(activeProject.id);

  const openProjectSettings = () => {
    setEditProjName(activeProject.name);
    setEditProjDesc(activeProject.description || '');
    setEditProjStatus(activeProject.status);
    setEditProjVisibility(activeProject.visibility || 'public');
    setEditProjTargetDate(activeProject.targetDate || '');
    setEditProjColor(activeProject.color || '#0284c7');
    setIsSettingsOpen(true);
  };

  const handleSaveProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjName.trim()) return;
    setSavingSettings(true);
    try {
      await updateProject(activeProject.id, {
        name: editProjName.trim(),
        description: editProjDesc.trim(),
        status: editProjStatus,
        visibility: editProjVisibility,
        targetDate: editProjTargetDate,
        color: editProjColor
      });
      setIsSettingsOpen(false);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberUserIdToAdd) return;
    setAddingMember(true);
    try {
      await addProjectMember(activeProject.id, memberUserIdToAdd, memberRoleToAdd);
      setMemberUserIdToAdd('');
      setMemberRoleToAdd('member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleCreateProjectEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    await createEvent({
      projectId: activeProject.id,
      title: eventTitle.trim(),
      date: eventDate,
      time: eventTime,
      type: eventType,
      attendeeIds: []
    });
    setEventTitle('');
    setIsAddingEvent(false);
  };

  const tabs: { id: ProjectTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    {
      id: 'todos',
      label: 'To-Dos',
      icon: <CheckSquare className="w-4 h-4" />,
      badge: projectTasks.filter((t) => t.status !== 'completed').length
    },
    { id: 'discussions', label: 'Message Board', icon: <MessageSquare className="w-4 h-4" />, badge: projectDiscussions.length },
    { id: 'approvals', label: 'Approvals Queue', icon: <ShieldCheck className="w-4 h-4" />, badge: stats.forApprovalTasks },
    { id: 'files', label: 'Files & Assets', icon: <Files className="w-4 h-4" />, badge: projectFiles.length },
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" />, badge: projectEvents.length },
    { id: 'activity', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" />, badge: members.length }
  ];

  const filteredTasks = projectTasks.filter((t) => {
    if (taskSearchQuery.trim() && !t.title.toLowerCase().includes(taskSearchQuery.toLowerCase())) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (assigneeFilter !== 'all' && !t.assignedUserIds.includes(assigneeFilter)) return false;
    return true;
  });

  const kanbanColumns: { id: TaskStatus; label: string; color: string }[] = [
    { id: 'todo', label: 'To Do', color: 'border-slate-300' },
    { id: 'in_progress', label: 'In Progress', color: 'border-blue-400' },
    { id: 'pending', label: 'Pending', color: 'border-yellow-400' },
    { id: 'for_revision', label: 'For Revision', color: 'border-orange-400' },
    { id: 'for_approval', label: 'For Approval', color: 'border-amber-500' },
    { id: 'completed', label: 'Completed', color: 'border-emerald-500' }
  ];

  // Calendar grid computation
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
      {/* Workspace Sub-Header */}
      <div className="bg-white border-b border-slate-200 px-6 pt-5 pb-0 shadow-2xs shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: activeProject.color }} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
                  {activeProject.name}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    activeProject.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {activeProject.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                {activeProject.description || 'Project workspace environment'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => {
                setQuickCreateType('task');
                setIsQuickCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
            <button
              onClick={() => {
                setQuickCreateType('discussion');
                setIsQuickCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Post Update</span>
            </button>
            {canManage && (
              <button
                onClick={openProjectSettings}
                className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
                title="Project Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Row */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-100 pt-1">
          {tabs.map((tab) => {
            const isSelected = activeProjectTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveProjectTab(tab.id);
                  setSelectedDiscussionId(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono-tabular font-medium ${
                      tab.id === 'approvals' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
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

      {/* Main Tab Content Viewport */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
        {/* 1. OVERVIEW TAB */}
        {activeProjectTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <span className="text-slate-500 text-[11px] block">Overall Completion</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-display text-slate-900 font-mono-tabular">
                    {stats.completionPercentage}%
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono-tabular">
                    ({stats.completedTasks}/{stats.totalTasks} tasks)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${stats.completionPercentage}%`, backgroundColor: activeProject.color }}
                  />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <span className="text-slate-500 text-[11px] block">Approval Queue</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-display text-amber-600 font-mono-tabular">
                    {stats.forApprovalTasks}
                  </span>
                  <span className="text-[11px] text-slate-400">pending review</span>
                </div>
                <p className="text-[11px] text-amber-700 mt-3 font-medium">
                  {stats.forApprovalTasks > 0 ? 'Requires approver attention' : 'All submissions cleared'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <span className="text-slate-500 text-[11px] block">Average Turnaround (TAT)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-display text-slate-900 font-mono-tabular">
                    {stats.avgTurnaroundHours > 0 ? `${stats.avgTurnaroundHours}h` : '—'}
                  </span>
                  <span className="text-[11px] text-slate-400">completion avg</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-3">Target SLA: &lt; 48 hours</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <span className="text-slate-500 text-[11px] block">Project Members</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-display text-slate-900 font-mono-tabular">
                    {members.length}
                  </span>
                  <span className="text-[11px] text-slate-400">collaborators</span>
                </div>
                <div className="flex items-center -space-x-1.5 mt-3">
                  {memberUsers.slice(0, 5).map((u) => (
                    <img
                      key={u.id}
                      src={u.avatar}
                      alt={u.name}
                      className="w-5 h-5 rounded-full border border-white object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
                    Key Project Tasks
                  </h3>
                  <button
                    onClick={() => setActiveProjectTab('todos')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <span>View all ({projectTasks.length})</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {projectTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4">No tasks created in this project yet.</p>
                ) : (
                  <div className="space-y-2">
                    {projectTasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="p-3 border border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 truncate">{task.title}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                task.status === 'for_approval'
                                  ? 'bg-amber-100 text-amber-800'
                                  : task.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : task.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 font-mono-tabular">
                            <span>Due {task.dueDate}</span>
                            <span>·</span>
                            <span>
                              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                      Recent Discussions
                    </h3>
                    <button
                      onClick={() => setActiveProjectTab('discussions')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View board
                    </button>
                  </div>

                  {projectDiscussions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No discussions posted yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {projectDiscussions.slice(0, 3).map((disc) => {
                        const author = users.find((u) => u.id === disc.authorId);
                        return (
                          <div
                            key={disc.id}
                            onClick={() => {
                              setSelectedDiscussionId(disc.id);
                              setActiveProjectTab('discussions');
                            }}
                            className="p-2.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-lg cursor-pointer transition-colors text-xs"
                          >
                            <div className="font-semibold text-slate-900 truncate mb-1">
                              {disc.pinned && <Pin className="w-3 h-3 text-amber-600 inline mr-1" />}
                              {disc.title}
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mb-1.5">{disc.content}</p>
                            <span className="text-[10px] text-slate-400 font-mono-tabular">
                              By {author?.name || 'Member'} · {new Date(disc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                    Recent Project Activity
                  </h3>
                  {projectActivities.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No recorded activity yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {projectActivities.slice(0, 4).map((act) => {
                        const actor = users.find((u) => u.id === act.userId);
                        return (
                          <div key={act.id} className="text-xs flex items-start gap-2">
                            <img
                              src={actor?.avatar || 'https://ui-avatars.com/api/?name=User'}
                              alt={actor?.name || 'User'}
                              className="w-4 h-4 rounded-full object-cover shrink-0 mt-0.5"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-slate-900">{actor?.name || 'Member'}</span>{' '}
                              <span className="text-slate-600">{act.details || act.action}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TO-DOS / TASKS TAB */}
        {activeProjectTab === 'todos' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setTodoViewMode('kanban')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    todoViewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>Kanban Board</span>
                </button>
                <button
                  onClick={() => setTodoViewMode('list')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    todoViewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List View</span>
                </button>
                <button
                  onClick={() => setTodoViewMode('calendar')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    todoViewMode === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendar View</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                  />
                </div>

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

                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-hidden"
                >
                  <option value="all">All Assignees</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setQuickCreateType('task');
                    setIsQuickCreateOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Task</span>
                </button>
              </div>
            </div>

            {/* KANBAN BOARD WITH HTML5 DRAG & DROP */}
            {todoViewMode === 'kanban' && (
              <div className="overflow-x-auto pb-4">
                <div className="flex items-start gap-4 min-w-[1200px]">
                  {kanbanColumns.map((col) => {
                    const colTasks = filteredTasks.filter((t) => t.status === col.id);
                    const isDropTarget = dragOverColumn === col.id;
                    return (
                      <div
                        key={col.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverColumn !== col.id) setDragOverColumn(col.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverColumn === col.id) setDragOverColumn(null);
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          const droppedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
                          setDragOverColumn(null);
                          setDraggedTaskId(null);
                          if (droppedId) {
                            const t = projectTasks.find((item) => item.id === droppedId);
                            if (t && t.status !== col.id) {
                              await moveTaskStatus(droppedId, col.id);
                            }
                          }
                        }}
                        className={`flex-1 rounded-xl p-3 flex flex-col min-h-[500px] border transition-colors ${
                          isDropTarget
                            ? 'bg-blue-50/70 border-blue-400'
                            : 'bg-slate-100/70 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                              {col.label}
                            </span>
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono-tabular font-bold flex items-center justify-center">
                              {colTasks.length}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2.5 flex-1">
                          {colTasks.map((task) => {
                            const assignees = users.filter((u) => task.assignedUserIds.includes(u.id));
                            const isOverdue = task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'completed';

                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedTaskId(task.id);
                                  e.dataTransfer.setData('text/plain', task.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragEnd={() => {
                                  setDraggedTaskId(null);
                                  setDragOverColumn(null);
                                }}
                                onClick={() => setSelectedTaskId(task.id)}
                                className={`bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-3 shadow-2xs hover:shadow-xs cursor-grab active:cursor-grabbing transition-all space-y-2 ${
                                  draggedTaskId === task.id ? 'opacity-50' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <span className="font-semibold text-xs text-slate-900 leading-snug line-clamp-2">
                                    {task.title}
                                  </span>
                                  {task.priority === 'urgent' && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" title="Urgent" />
                                  )}
                                  {task.priority === 'high' && (
                                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" title="High Priority" />
                                  )}
                                </div>

                                {task.description && (
                                  <p className="text-[11px] text-slate-500 line-clamp-2">{task.description}</p>
                                )}

                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono-tabular pt-1 border-t border-slate-100">
                                  <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>{task.dueDate}</span>
                                  <span>
                                    {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} done
                                  </span>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <div className="flex items-center -space-x-1">
                                    {assignees.map((u) => (
                                      <img
                                        key={u.id}
                                        src={u.avatar}
                                        alt={u.name}
                                        className="w-5 h-5 rounded-full border border-white object-cover"
                                        title={u.name}
                                        referrerPolicy="no-referrer"
                                      />
                                    ))}
                                  </div>

                                  <select
                                    value={task.status}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      moveTaskStatus(task.id, e.target.value as TaskStatus);
                                    }}
                                    className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-hidden"
                                  >
                                    <option value="todo">To Do</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="pending">Pending</option>
                                    <option value="for_revision" disabled={!isApprover}>For Revision</option>
                                    <option value="for_approval">For Approval</option>
                                    <option value="completed" disabled={!isApprover}>Completed</option>
                                  </select>
                                </div>
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

            {/* LIST VIEW */}
            {todoViewMode === 'list' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No tasks match the active filters.</div>
                ) : (
                  filteredTasks.map((task) => {
                    const assignees = users.filter((u) => task.assignedUserIds.includes(u.id));
                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="p-3.5 hover:bg-slate-50/70 cursor-pointer transition-colors flex items-center justify-between gap-4 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 truncate">{task.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                task.status === 'for_approval'
                                  ? 'bg-amber-100 text-amber-800'
                                  : task.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : task.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {task.description || 'No description'}
                          </p>
                        </div>

                        <div className="flex items-center gap-6 shrink-0 font-mono-tabular text-slate-600">
                          <span className="text-[11px]">{task.dueDate}</span>
                          <span className="text-[11px] capitalize">{task.priority}</span>
                          <div className="flex items-center -space-x-1">
                            {assignees.map((u) => (
                              <img
                                key={u.id}
                                src={u.avatar}
                                alt={u.name}
                                className="w-5 h-5 rounded-full border border-white object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ))}
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* CALENDAR VIEW */}
            {todoViewMode === 'calendar' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 font-display">
                    {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
                      className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 text-center py-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                  {calendarCells.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty_${idx}`} className="min-h-24 bg-slate-50/40 p-1.5" />;
                    }
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayTasks = filteredTasks.filter((t) => t.dueDate === dateStr);
                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                    return (
                      <div key={dateStr} className="min-h-24 p-1.5 space-y-1 bg-white">
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-[11px] font-mono-tabular w-5 h-5 flex items-center justify-center rounded-full ${
                              isToday ? 'bg-slate-900 text-white font-bold' : 'text-slate-500'
                            }`}
                          >
                            {day}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {dayTasks.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTaskId(t.id)}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate block ${
                                t.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : t.status === 'for_approval'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-blue-50 text-blue-800'
                              }`}
                            >
                              {t.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. MESSAGE BOARD / DISCUSSIONS TAB */}
        {activeProjectTab === 'discussions' && (
          <div className="space-y-6">
            {selectedDiscussionId ? (
              (() => {
                const disc = projectDiscussions.find((d) => d.id === selectedDiscussionId);
                if (!disc) return null;
                const author = users.find((u) => u.id === disc.authorId);
                const canModifyDisc = currentUser?.id === disc.authorId || canManage || isAdmin || isSuperAdmin;

                return (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setSelectedDiscussionId(null)}
                        className="text-xs text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1"
                      >
                        <ArrowRight className="w-3 h-3 rotate-180" />
                        <span>Back to all discussions</span>
                      </button>

                      {canModifyDisc && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => togglePinDiscussion(disc.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 ${
                              disc.pinned
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <Pin className="w-3 h-3" />
                            <span>{disc.pinned ? 'Unpin' : 'Pin'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteDiscussion(activeProject.id, disc.id);
                              setSelectedDiscussionId(null);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Delete Discussion"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase rounded">
                          {disc.category}
                        </span>
                        {disc.pinned && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded flex items-center gap-1">
                            <Pin className="w-3 h-3" /> Pinned
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-mono-tabular">
                        {new Date(disc.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold font-display text-slate-900">{disc.title}</h2>

                    <div className="flex items-center gap-2 text-xs text-slate-500 pb-3 border-b border-slate-100">
                      <img
                        src={author?.avatar || 'https://ui-avatars.com/api/?name=User'}
                        alt={author?.name || 'User'}
                        className="w-5 h-5 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span>
                        Posted by <strong>{author?.name || 'Member'}</strong>
                      </span>
                    </div>

                    <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap py-2">
                      {disc.content}
                    </div>

                    <CommentThread
                      projectId={activeProject.id}
                      targetType="discussion"
                      targetId={disc.id}
                      title="Replies & Conversation"
                    />
                  </div>
                );
              })()
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Message Board Posts ({projectDiscussions.length})
                  </h2>
                  <button
                    onClick={() => {
                      setQuickCreateType('discussion');
                      setIsQuickCreateOpen(true);
                    }}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Topic</span>
                  </button>
                </div>

                {projectDiscussions.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-400">
                    No topics posted on this project's Message Board yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projectDiscussions.map((disc) => {
                      const author = users.find((u) => u.id === disc.authorId);
                      return (
                        <div
                          key={disc.id}
                          onClick={() => setSelectedDiscussionId(disc.id)}
                          className={`bg-white border rounded-xl p-5 hover:border-slate-300 cursor-pointer transition-all shadow-2xs space-y-3 flex flex-col justify-between ${
                            disc.pinned ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                {disc.category}
                              </span>
                              {disc.pinned && (
                                <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                                  <Pin className="w-3 h-3" /> Pinned
                                </span>
                              )}
                            </div>

                            <h3 className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors">
                              {disc.title}
                            </h3>
                            <p className="text-xs text-slate-600 line-clamp-3 mt-1.5 leading-relaxed">{disc.content}</p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <img
                                src={author?.avatar || 'https://ui-avatars.com/api/?name=User'}
                                alt={author?.name || 'User'}
                                className="w-4 h-4 rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <span className="text-slate-600 font-medium">{author?.name || 'Member'}</span>
                            </div>
                            <span className="font-mono-tabular">
                              {new Date(disc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. APPROVALS QUEUE TAB */}
        {activeProjectTab === 'approvals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  MARS Task Approval Center
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review submitted deliverables, verify attachments, track turnaround times, or request revisions.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {projectTasks.filter((t) => t.status === 'for_approval' || t.status === 'for_revision' || t.status === 'completed').length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-400">
                  No submissions currently in the approval workflow for this project.
                </div>
              ) : (
                projectTasks
                  .filter((t) => t.status === 'for_approval' || t.status === 'for_revision' || t.status === 'completed')
                  .map((task) => {
                    const lastRec = task.approvalHistory[task.approvalHistory.length - 1];
                    const submitter = users.find((u) => u.id === lastRec?.submittedBy);

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-2xs hover:shadow-xs cursor-pointer transition-colors space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{task.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                task.status === 'for_approval'
                                  ? 'bg-amber-100 text-amber-800'
                                  : task.status === 'for_revision'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs font-mono-tabular text-slate-500">
                            <span>
                              TAT:{' '}
                              {task.tatMetrics?.totalCompletionHours !== undefined
                                ? `${task.tatMetrics.totalCompletionHours}h total`
                                : task.tatMetrics?.approvalTurnaroundHours !== undefined
                                ? `${task.tatMetrics.approvalTurnaroundHours}h approval`
                                : 'Pending'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTaskId(task.id);
                              }}
                              className="px-3 py-1 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800 transition-colors"
                            >
                              Review Submission
                            </button>
                          </div>
                        </div>

                        {lastRec && (
                          <div className="p-3 bg-slate-50 rounded-lg text-xs border border-slate-200/80">
                            <div className="text-[11px] text-slate-500 font-medium mb-1">
                              Round {lastRec.round} · Submitted by {submitter?.name || 'Designer'} on{' '}
                              {new Date(lastRec.submittedAt).toLocaleDateString()}
                            </div>
                            <p className="text-slate-800 italic">"{lastRec.designerRemarks}"</p>
                            {lastRec.revisionNotes && (
                              <div className="mt-2 text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                                <strong>Revision Notes:</strong> {lastRec.revisionNotes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* 5. FILES & ASSETS TAB */}
        {activeProjectTab === 'files' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Project Files & Documents ({projectFiles.length})
              </h2>
              <button
                onClick={() => {
                  setQuickCreateType('file');
                  setIsQuickCreateOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </button>
            </div>

            {projectFiles.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-400">
                No files uploaded to this project yet. Click "Upload Document" to add specifications or assets.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectFiles.map((file) => {
                  const uploader = users.find((u) => u.id === file.uploadedBy);
                  const canDeleteFile = currentUser?.id === file.uploadedBy || canManage || isAdmin || isSuperAdmin;
                  return (
                    <div
                      key={file.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                          <span className="font-semibold text-slate-600 uppercase tracking-wider">{file.folder}</span>
                          <span className="font-mono-tabular">{file.size}</span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 truncate">{file.name}</h4>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          By {uploader?.name || 'Team'} · {file.downloadsCount || 0} downloads
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => downloadFile(file)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                          >
                            <span>Download</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          {canDeleteFile && (
                            <button
                              type="button"
                              onClick={() => deleteFile(activeProject.id, file.id, file.url)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Delete File"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. SCHEDULE TAB */}
        {activeProjectTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Milestones & Key Dates ({projectEvents.length})
              </h2>
              <button
                type="button"
                onClick={() => setIsAddingEvent((v) => !v)}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </button>
            </div>

            {isAddingEvent && (
              <form onSubmit={handleCreateProjectEvent} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Milestone or review title *"
                    className="sm:col-span-2 p-2 border border-slate-200 rounded-lg"
                  />
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg"
                  />
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="p-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="milestone">Milestone</option>
                    <option value="review">Review Gate</option>
                    <option value="deadline">Deadline</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    placeholder="Time (e.g. 10:00 - 11:00)"
                    className="p-2 border border-slate-200 rounded-lg w-48"
                  />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsAddingEvent(false)} className="px-3 py-1.5 text-slate-600">
                      Cancel
                    </button>
                    <button type="submit" className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold">
                      Save Milestone
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {projectEvents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No schedule events set for this project.</div>
              ) : (
                projectEvents.map((event) => (
                  <div key={event.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 text-sm block">{event.title}</span>
                      <p className="text-slate-500 text-[11px] mt-0.5 capitalize">{event.type}</p>
                    </div>
                    <div className="flex items-center gap-3 font-mono-tabular">
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">{event.date}</span>
                        {event.time && <span className="text-slate-400 text-[11px]">{event.time}</span>}
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => deleteEvent(activeProject.id, event.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 7. ACTIVITY TIMELINE TAB */}
        {activeProjectTab === 'activity' && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Audit Timeline</h2>

            {projectActivities.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-400">
                No project activity logged yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                {projectActivities.map((act) => {
                  const actor = users.find((u) => u.id === act.userId);
                  return (
                    <div key={act.id} className="flex items-start gap-3 text-xs">
                      <img
                        src={actor?.avatar || 'https://ui-avatars.com/api/?name=User'}
                        alt={actor?.name || 'User'}
                        className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800">
                          <strong>{actor?.name || 'Member'}</strong> {act.details || act.action.replace('_', ' ')}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono-tabular">
                          {new Date(act.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 8. MEMBERS TAB */}
        {activeProjectTab === 'members' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Project Team Roster ({members.length})
              </h2>

              {canManage && nonMemberUsers.length > 0 && (
                <form onSubmit={handleAddMember} className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={memberUserIdToAdd}
                    onChange={(e) => setMemberUserIdToAdd(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="">Select user to add...</option>
                    {nonMemberUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <select
                    value={memberRoleToAdd}
                    onChange={(e) => setMemberRoleToAdd(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="member">Member</option>
                    <option value="approver">Approver</option>
                    <option value="project_admin">Project Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={addingMember || !memberUserIdToAdd}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg font-semibold flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{addingMember ? 'Adding...' : 'Add Member'}</span>
                  </button>
                </form>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {members.map((member) => {
                const user = users.find((u) => u.id === member.userId);
                if (!user) return null;
                const isOwner = activeProject.ownerId === user.id;

                return (
                  <div key={member.userId} className="p-4 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{user.name}</span>
                          {isOwner && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {user.title || 'Member'} {user.department ? `· ${user.department}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canManage && !isOwner ? (
                        <select
                          value={member.role}
                          onChange={(e) => addProjectMember(activeProject.id, user.id, e.target.value)}
                          className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-800"
                        >
                          <option value="member">Member</option>
                          <option value="approver">Approver</option>
                          <option value="project_admin">Project Admin</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 capitalize">
                          {member.role.replace('_', ' ')}
                        </span>
                      )}

                      {canManage && !isOwner && (
                        <button
                          type="button"
                          onClick={() => removeProjectMember(activeProject.id, user.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Remove from project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Project Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Project Workspace Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProjectSettings} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={editProjName}
                  onChange={(e) => setEditProjName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editProjDesc}
                  onChange={(e) => setEditProjDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editProjStatus}
                    onChange={(e) => setEditProjStatus(e.target.value as ProjectStatus)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Visibility</label>
                  <select
                    value={editProjVisibility}
                    onChange={(e) => setEditProjVisibility(e.target.value as ProjectVisibility)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="public">Organization</option>
                    <option value="department">Department</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={editProjTargetDate}
                    onChange={(e) => setEditProjTargetDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={async () => {
                    await archiveProject(activeProject.id);
                    setIsSettingsOpen(false);
                  }}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold flex items-center gap-1"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Project</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings || !editProjName.trim()}
                    className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
