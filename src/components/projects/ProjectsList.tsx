import React, { useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Grid, 
  List, 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  MoreHorizontal
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProjectStatus } from '../../types';

export const ProjectsList: React.FC = () => {
  const { 
    projects, 
    users, 
    projectMembers, 
    activeView,
    setActiveProjectId, 
    setActiveProjectTab,
    setIsQuickCreateOpen,
    setQuickCreateType,
    getProjectStats
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>(
    activeView === 'archived' ? 'archived' : 'active'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    setStatusFilter(activeView === 'archived' ? 'archived' : 'active');
  }, [activeView]);

  const filteredProjects = projects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || 
             p.description.toLowerCase().includes(q) ||
             p.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
            Projects Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Projects are the central organizational workspace in MARS.
          </p>
        </div>

        <button
          onClick={() => {
            setQuickCreateType('project');
            setIsQuickCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project Workspace</span>
        </button>
      </div>

      {/* Filter and View Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Status Filter Tabs (Segmented control) */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full md:w-auto">
          {(['all', 'active', 'on_hold', 'completed', 'archived'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                statusFilter === tab 
                  ? 'bg-white text-slate-900 shadow-xs font-semibold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search & Layout Toggles */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter projects..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Display */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No projects found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search or filters, or create a new project workspace.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map(project => {
            const stats = getProjectStats(project.id);
            const members = projectMembers[project.id] || [];
            const memberProfiles = users.filter(u => members.some(m => m.userId === u.id));

            return (
              <div
                key={project.id}
                onClick={() => {
                  setActiveProjectId(project.id);
                  setActiveProjectTab('overview');
                }}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden shadow-2xs hover:shadow-sm cursor-pointer transition-all flex flex-col group"
              >
                {/* Top Colored Accent Stripe */}
                <div className="h-1.5 w-full" style={{ backgroundColor: project.color }} />

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                        {project.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                        project.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        project.status === 'on_hold' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold font-display text-slate-900 group-hover:text-blue-600 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                    {/* Progress */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1 font-mono-tabular">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-semibold text-slate-800">{stats.completionPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ width: `${stats.completionPercentage}%`, backgroundColor: project.color }}
                        />
                      </div>
                    </div>

                    {/* Stats pill breakdown */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs py-1">
                      <div className="p-1.5 bg-slate-50 rounded">
                        <span className="text-[10px] text-slate-400 block">Tasks</span>
                        <span className="font-bold text-slate-900 font-mono-tabular">{stats.totalTasks}</span>
                      </div>
                      <div className="p-1.5 bg-slate-50 rounded">
                        <span className="text-[10px] text-slate-400 block">Completed</span>
                        <span className="font-bold text-emerald-600 font-mono-tabular">{stats.completedTasks}</span>
                      </div>
                      <div className="p-1.5 bg-slate-50 rounded">
                        <span className="text-[10px] text-slate-400 block">For Approval</span>
                        <span className="font-bold text-amber-600 font-mono-tabular">{stats.forApprovalTasks}</span>
                      </div>
                    </div>

                    {/* Member Avatars & Target Date */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center -space-x-1.5">
                        {memberProfiles.slice(0, 4).map(u => (
                          <img
                            key={u.id}
                            src={u.avatar}
                            alt={u.name}
                            className="w-6 h-6 rounded-full border-2 border-white object-cover"
                            title={u.name}
                            referrerPolicy="no-referrer"
                          />
                        ))}
                        {memberProfiles.length > 4 && (
                          <span className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white text-[10px] flex items-center justify-center font-bold text-slate-600">
                            +{memberProfiles.length - 4}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-500 font-mono-tabular flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {project.targetDate}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100">
          {filteredProjects.map(project => {
            const stats = getProjectStats(project.id);
            const members = projectMembers[project.id] || [];
            const memberProfiles = users.filter(u => members.some(m => m.userId === u.id));

            return (
              <div
                key={project.id}
                onClick={() => {
                  setActiveProjectId(project.id);
                  setActiveProjectTab('overview');
                }}
                className="p-4 hover:bg-slate-50/70 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0 md:max-w-md">
                  <span 
                    className="w-3 h-3 rounded-full shrink-0 mt-1" 
                    style={{ backgroundColor: project.color }} 
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {project.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 font-mono-tabular">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Completion</span>
                    <span className="font-bold text-slate-900">{stats.completionPercentage}%</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Tasks</span>
                    <span>{stats.completedTasks} / {stats.totalTasks}</span>
                  </div>

                  {stats.forApprovalTasks > 0 && (
                    <div>
                      <span className="text-[10px] text-amber-600 block uppercase">Awaiting Review</span>
                      <span className="font-bold text-amber-700">{stats.forApprovalTasks}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Target Date</span>
                    <span>{project.targetDate}</span>
                  </div>

                  <div className="flex items-center -space-x-1.5">
                    {memberProfiles.slice(0, 3).map(u => (
                      <img
                        key={u.id}
                        src={u.avatar}
                        alt={u.name}
                        className="w-6 h-6 rounded-full border border-white object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden md:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
