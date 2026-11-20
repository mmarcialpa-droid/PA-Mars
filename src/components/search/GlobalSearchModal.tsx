import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  FolderKanban, 
  CheckSquare, 
  MessageSquare, 
  FileText, 
  Users, 
  ArrowRight,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const GlobalSearchModal: React.FC = () => {
  const { 
    isSearchOpen, 
    setIsSearchOpen, 
    projects, 
    tasks, 
    discussions, 
    files, 
    users, 
    setActiveProjectId, 
    setActiveProjectTab, 
    setSelectedTaskId,
    setActiveView 
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const cleanQuery = query.toLowerCase().trim();

  const matchedProjects = cleanQuery ? projects.filter(p => 
    p.name.toLowerCase().includes(cleanQuery) || 
    p.description.toLowerCase().includes(cleanQuery)
  ) : [];

  const matchedTasks = cleanQuery ? tasks.filter(t => 
    t.title.toLowerCase().includes(cleanQuery) || 
    t.description.toLowerCase().includes(cleanQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(cleanQuery))
  ) : [];

  const matchedDiscussions = cleanQuery ? discussions.filter(d => 
    d.title.toLowerCase().includes(cleanQuery) || 
    d.content.toLowerCase().includes(cleanQuery)
  ) : [];

  const matchedFiles = cleanQuery ? files.filter(f => 
    f.name.toLowerCase().includes(cleanQuery) || 
    f.folder.toLowerCase().includes(cleanQuery)
  ) : [];

  const matchedUsers = cleanQuery ? users.filter(u => 
    u.name.toLowerCase().includes(cleanQuery) || 
    u.email.toLowerCase().includes(cleanQuery) ||
    (u.department && u.department.toLowerCase().includes(cleanQuery))
  ) : [];

  const hasResults = 
    matchedProjects.length > 0 || 
    matchedTasks.length > 0 || 
    matchedDiscussions.length > 0 || 
    matchedFiles.length > 0 || 
    matchedUsers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-xs">
      <div 
        className="fixed inset-0" 
        onClick={() => setIsSearchOpen(false)} 
      />

      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-200 flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, tasks, discussions, files, members..."
            className="flex-1 text-sm bg-transparent border-none outline-hidden text-slate-900 placeholder:text-slate-400"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-2 py-0.5 text-[10px] font-mono-tabular bg-slate-100 border border-slate-200 rounded text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {!query && (
            <div className="py-10 text-center">
              <p className="text-xs text-slate-400">
                Type anything to search across the entire MARS workspace.
              </p>
              <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-slate-400">
                <span className="px-2 py-0.5 bg-slate-100 rounded">Projects</span>
                <span>·</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded">Tasks & Approvals</span>
                <span>·</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded">Discussions</span>
                <span>·</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded">Documents</span>
              </div>
            </div>
          )}

          {query && !hasResults && (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching records found for "{query}".
            </div>
          )}

          {/* Matched Projects */}
          {matchedProjects.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-600 px-2 mb-1 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5" />
                PROJECTS ({matchedProjects.length})
              </div>
              <div className="space-y-1">
                {matchedProjects.map(proj => (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setActiveProjectId(proj.id);
                      setActiveProjectTab('overview');
                      setIsSearchOpen(false);
                    }}
                    className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs border border-transparent hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{proj.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{proj.description}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Tasks */}
          {matchedTasks.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-600 px-2 mb-1 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                TASKS & APPROVALS ({matchedTasks.length})
              </div>
              <div className="space-y-1">
                {matchedTasks.map(task => {
                  const proj = projects.find(p => p.id === task.projectId);
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setActiveProjectId(task.projectId);
                        setSelectedTaskId(task.id);
                        setIsSearchOpen(false);
                      }}
                      className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs border border-transparent hover:border-slate-200 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 truncate">{task.title}</span>
                          {task.status === 'for_approval' && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[10px] font-medium flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Awaiting Approval
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono-tabular">
                            Due {task.dueDate}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                          <span>{proj?.name || 'Project'}</span>
                          <span>·</span>
                          <span>Status: {task.status.replace('_', ' ')}</span>
                          <span>·</span>
                          <span>Priority: {task.priority}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matched Discussions */}
          {matchedDiscussions.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-600 px-2 mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                DISCUSSIONS ({matchedDiscussions.length})
              </div>
              <div className="space-y-1">
                {matchedDiscussions.map(disc => {
                  const proj = projects.find(p => p.id === disc.projectId);
                  return (
                    <div
                      key={disc.id}
                      onClick={() => {
                        setActiveProjectId(disc.projectId);
                        setActiveProjectTab('discussions');
                        setIsSearchOpen(false);
                      }}
                      className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs border border-transparent hover:border-slate-200 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{disc.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{proj?.name} · {disc.content}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matched Files */}
          {matchedFiles.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-600 px-2 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                FILES ({matchedFiles.length})
              </div>
              <div className="space-y-1">
                {matchedFiles.map(file => {
                  const proj = projects.find(p => p.id === file.projectId);
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        setActiveProjectId(file.projectId);
                        setActiveProjectTab('files');
                        setIsSearchOpen(false);
                      }}
                      className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs border border-transparent hover:border-slate-200 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{file.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{proj?.name} · Folder: {file.folder} · {file.size}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matched Users */}
          {matchedUsers.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-600 px-2 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                TEAM MEMBERS ({matchedUsers.length})
              </div>
              <div className="space-y-1">
                {matchedUsers.map(user => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setActiveView('team_directory');
                      setIsSearchOpen(false);
                    }}
                    className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs border border-transparent hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <img 
                        src={user.avatar} 
                        alt={user.name} 
                        className="w-6 h-6 rounded-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="font-semibold text-slate-900">{user.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {user.title || 'Member'} {user.department ? `· ${user.department}` : ''}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
