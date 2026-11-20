import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Bell, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  FolderKanban, 
  MessageSquare, 
  ShieldCheck,
  Network
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopBar: React.FC = () => {
  const { 
    activeView, 
    setActiveView,
    activeProject, 
    setActiveProjectId,
    activeProjectTab,
    setActiveProjectTab,
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    setIsSearchOpen,
    setIsQuickCreateOpen,
    setQuickCreateType,
    setSelectedTaskId,
    setIsOrgChartOpen,
    currentUser,
    signOut
  } = useApp();

  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showQuickCreateMenu, setShowQuickCreateMenu] = useState(false);

  const viewTitles: Record<string, string> = {
    home: 'Home Dashboard',
    my_tasks: 'My Tasks',
    projects: 'All Projects',
    schedule: 'Global Schedule',
    approvals: 'Approvals Center',
    notifications: 'Notifications',
    my_files: 'My Files & Documents',
    team_directory: 'Team Directory',
    reports: 'TAT & Reports',
    admin_hub: 'Administration Hub',
    archived: 'Archived Projects',
    settings: 'Workspace Settings'
  };

  const projectTabTitles: Record<string, string> = {
    overview: 'Overview',
    todos: 'To-Dos & Tasks',
    discussions: 'Message Board',
    files: 'Files',
    schedule: 'Schedule',
    activity: 'Activity',
    approvals: 'Approvals',
    members: 'Members'
  };

  const userNotifications = currentUser 
    ? notifications.filter(n => n.recipientId === currentUser.id)
    : [];

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    markNotificationAsRead(notif.id);
    setShowNotificationsDropdown(false);
    
    if (notif.projectId) {
      setActiveProjectId(notif.projectId);
      if (notif.targetType === 'approval' || notif.targetType === 'task') {
        setSelectedTaskId(notif.targetId);
      } else if (notif.targetType === 'discussion') {
        setActiveProjectTab('discussions');
      }
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6 shrink-0 z-20">
      {/* Zone 1: Contextual Breadcrumb Trail */}
      <div className="flex items-center gap-2 min-w-0 text-sm">
        {activeProject ? (
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
            <button 
              onClick={() => {
                setActiveProjectId(null);
                setActiveView('projects');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              Projects
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <button 
              onClick={() => setActiveProjectTab('overview')}
              className="font-medium text-slate-900 hover:underline max-w-[200px] truncate"
            >
              {activeProject.name}
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-slate-700 font-semibold">
              {projectTabTitles[activeProjectTab] || 'Overview'}
            </span>
          </nav>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight whitespace-nowrap">
              {viewTitles[activeView] || 'Workspace'}
            </h1>
          </div>
        )}
      </div>

      {/* Zone 2: Global Search Bar */}
      <div className="flex-1 max-w-md hidden md:block">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs text-slate-500 transition-colors border border-transparent hover:border-slate-300/50"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search projects, tasks, discussions, files...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono-tabular bg-white border border-slate-200 rounded text-slate-500 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Actions (Quick Create, Org Chart, Notifications, Profile) */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Mobile Search Button */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="md:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Org Chart Trigger */}
        <button
          onClick={() => setIsOrgChartOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          title="Organizational Hierarchy Chart"
        >
          <Network className="w-3.5 h-3.5 text-purple-600" />
          <span>Org Chart</span>
        </button>

        {/* Quick Create Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowQuickCreateMenu(!showQuickCreateMenu)}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>

          {showQuickCreateMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowQuickCreateMenu(false)} 
              />
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-1 space-y-0.5">
                <button
                  onClick={() => {
                    setQuickCreateType('task');
                    setIsQuickCreateOpen(true);
                    setShowQuickCreateMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>New Task</span>
                </button>
                <button
                  onClick={() => {
                    setQuickCreateType('project');
                    setIsQuickCreateOpen(true);
                    setShowQuickCreateMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left transition-colors"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-emerald-600" />
                  <span>New Project</span>
                </button>
                <button
                  onClick={() => {
                    setQuickCreateType('discussion');
                    setIsQuickCreateOpen(true);
                    setShowQuickCreateMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                  <span>New Discussion</span>
                </button>
                <button
                  onClick={() => {
                    setQuickCreateType('file');
                    setIsQuickCreateOpen(true);
                    setShowQuickCreateMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Upload File</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
            className="relative p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600" />
            )}
          </button>

          {/* Notifications Dropdown Drawer */}
          {showNotificationsDropdown && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowNotificationsDropdown(false)} 
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">Notifications</span>
                    {unreadNotificationsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tabular bg-blue-100 text-blue-800">
                        {unreadNotificationsCount} unread
                      </span>
                    )}
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {userNotifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    userNotifications.slice(0, 6).map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                          !notif.isRead ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {notif.type === 'submitted_approval' && <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />}
                            {notif.type === 'revision_requested' && <AlertCircle className="w-3.5 h-3.5 text-orange-600" />}
                            {notif.type === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono-tabular shrink-0">
                            {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-slate-600 line-clamp-2 leading-relaxed text-[11px]">
                          {notif.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                  <button
                    onClick={() => {
                      setShowNotificationsDropdown(false);
                      setActiveProjectId(null);
                      setActiveView('notifications');
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    View All Notifications
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User avatar display */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-1" title={`${currentUser.name} (${currentUser.email})`}>
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>
    </header>
  );
};
