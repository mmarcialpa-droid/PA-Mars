import React, { useState } from 'react';
import { 
  Home, 
  CheckSquare, 
  FolderKanban, 
  Calendar, 
  ShieldCheck, 
  Bell, 
  Files, 
  Users, 
  BarChart3, 
  Archive, 
  Settings, 
  ChevronRight, 
  Plus, 
  PanelLeftClose, 
  PanelLeft,
  ChevronDown,
  Network,
  LogOut,
  Building2,
  Briefcase
} from 'lucide-react';
import { useApp, GlobalNavView } from '../../context/AppContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const { 
    activeView, 
    setActiveView, 
    projects, 
    activeProjectId, 
    setActiveProjectId, 
    tasks, 
    currentUser, 
    departments,
    positions,
    roles,
    unreadNotificationsCount,
    setIsQuickCreateOpen,
    setQuickCreateType,
    setIsOrgChartOpen,
    isSuperAdmin,
    isAdmin,
    hasPermission,
    signOut
  } = useApp();

  const [showUserMenu, setShowUserMenu] = useState(false);

  // My open tasks count
  const myOpenTasksCount = currentUser ? tasks.filter(
    t => t.assignedUserIds.includes(currentUser.id) && t.status !== 'completed'
  ).length : 0;

  // Awaiting approval count
  const awaitingApprovalCount = tasks.filter(t => t.status === 'for_approval').length;

  const canViewApprovals = isSuperAdmin || isAdmin || hasPermission('view_approval_center') || hasPermission('approve_tasks');
  const canViewReports = isSuperAdmin || isAdmin || hasPermission('view_reports');

  const navItems: { id: GlobalNavView; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string; visible?: boolean }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'my_tasks', label: 'My Tasks', icon: <CheckSquare className="w-4 h-4" />, badge: myOpenTasksCount },
    { id: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" />, badge: projects.filter(p => p.status === 'active').length },
    { id: 'approvals', label: 'Approvals Center', icon: <ShieldCheck className="w-4 h-4" />, badge: awaitingApprovalCount, badgeColor: 'bg-amber-100 text-amber-800', visible: canViewApprovals },
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, badge: unreadNotificationsCount, badgeColor: 'bg-blue-100 text-blue-700' },
    { id: 'my_files', label: 'My Files', icon: <Files className="w-4 h-4" /> },
    { id: 'team_directory', label: 'Team Directory', icon: <Users className="w-4 h-4" /> },
    { id: 'reports', label: 'TAT & Reports', icon: <BarChart3 className="w-4 h-4" />, visible: canViewReports },
    { id: 'admin_hub', label: 'Admin Hub', icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />, visible: isSuperAdmin || isAdmin },
    { id: 'archived', label: 'Archived', icon: <Archive className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> }
  ];

  const handleSelectNav = (viewId: GlobalNavView) => {
    setActiveView(viewId);
    setActiveProjectId(null); // Return to global view
  };

  const handleSelectProject = (projId: string) => {
    setActiveProjectId(projId);
  };

  const userDept = departments.find(d => d.id === currentUser?.departmentId);
  const userPos = positions.find(p => p.id === currentUser?.positionId);
  const userPrimaryRole = roles.find(r => r.id === currentUser?.primaryRoleId || r.id === currentUser?.roleIds?.[0]);

  return (
    <aside 
      className={`h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-200 shrink-0 select-none z-30 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between gap-2">
        {!collapsed && (
          <div 
            onClick={() => handleSelectNav('home')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold font-display text-sm tracking-tight shadow-xs">
              M
            </div>
            <div>
              <span className="font-display font-bold text-base text-slate-900 tracking-tight leading-none">
                MARS
              </span>
              <p className="text-[11px] text-slate-500 font-medium tracking-tight leading-none mt-0.5">
                Workspace & Projects
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div 
            onClick={() => handleSelectNav('home')}
            className="w-8 h-8 mx-auto rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold font-display text-sm cursor-pointer"
          >
            M
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors ml-auto"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick Action Button (when expanded) */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-slate-100 flex items-center gap-1.5">
          <button
            onClick={() => {
              setQuickCreateType('task');
              setIsQuickCreateOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task / Project</span>
          </button>
          
          <button
            onClick={() => setIsOrgChartOpen(true)}
            className="p-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
            title="View Organizational Chart"
          >
            <Network className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        <div className="space-y-0.5">
          {navItems.map(item => {
            if (item.visible === false) return null;

            const isSelected = activeProjectId === null && activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  isSelected 
                    ? 'bg-slate-100 text-slate-900 font-semibold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={isSelected ? 'text-slate-900' : 'text-slate-500'}>
                  {item.icon}
                </span>

                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-medium ${
                        item.badgeColor || 'bg-slate-200 text-slate-700'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Projects Section */}
        {!collapsed && (
          <div className="pt-4 mt-3 border-t border-slate-100">
            <div className="px-3 mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 tracking-wider">
                ACTIVE PROJECTS
              </span>
              <button
                onClick={() => {
                  setQuickCreateType('project');
                  setIsQuickCreateOpen(true);
                }}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                title="Create Project"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5">
              {projects.filter(p => p.status === 'active').length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-400 italic">No active projects yet</p>
              ) : (
                projects.filter(p => p.status === 'active').map(project => {
                  const isSelected = activeProjectId === project.id;
                  return (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs transition-colors text-left ${
                        isSelected 
                          ? 'bg-slate-100 text-slate-900 font-semibold' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: project.color }} 
                      />
                      <span className="flex-1 truncate">{project.name}</span>
                      {isSelected && <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Real Authenticated User Profile Footer (No Role Switcher) */}
      {currentUser && (
        <div className="p-2 border-t border-slate-200 bg-slate-50/70">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors text-left"
              title="User Account Options"
            >
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
                referrerPolicy="no-referrer"
              />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    <span>{userPrimaryRole?.name || 'Member'}</span>
                    {userDept && (
                      <>
                        <span>·</span>
                        <span>{userDept.name}</span>
                      </>
                    )}
                  </p>
                </div>
              )}
              {!collapsed && <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />}
            </button>

            {/* User Account Dropdown Menu */}
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowUserMenu(false)} 
                />
                <div className="absolute bottom-12 left-0 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2 space-y-1 text-xs">
                  <div className="p-2 bg-slate-50 rounded-md border border-slate-100 text-xs">
                    <p className="font-bold text-slate-900">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</p>
                    {userPos && (
                      <p className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-slate-400" />
                        <span>{userPos.title} (Level {userPos.level})</span>
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setIsOrgChartOpen(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-700 hover:bg-slate-100 text-left"
                  >
                    <Network className="w-3.5 h-3.5 text-purple-600" />
                    <span>View Organizational Chart</span>
                  </button>

                  {(isSuperAdmin || isAdmin) && (
                    <button
                      onClick={() => {
                        setActiveView('admin_hub');
                        setActiveProjectId(null);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-700 hover:bg-slate-100 text-left"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Administration Hub</span>
                    </button>
                  )}

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={async () => {
                        setShowUserMenu(false);
                        await signOut();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-rose-600 hover:bg-rose-50 text-left font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
