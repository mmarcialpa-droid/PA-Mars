import React, { useState } from 'react';
import { Files, Plus, Search, ExternalLink, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MyFilesView: React.FC = () => {
  const {
    files,
    projects,
    users,
    currentUser,
    isAdmin,
    isSuperAdmin,
    setIsQuickCreateOpen,
    setQuickCreateType,
    downloadFile,
    deleteFile
  } = useApp();

  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');

  const folders = Array.from(new Set(files.map((f) => f.folder)));

  const filteredFiles = files.filter((f) => {
    if (folderFilter !== 'all' && f.folder !== folderFilter) return false;
    if (search.trim() && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
            Workspace Files & Assets
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Central repository of cross-project design specifications, contracts, and documents.
          </p>
        </div>

        <button
          onClick={() => {
            setQuickCreateType('file');
            setIsQuickCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFolderFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              folderFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Folders
          </button>
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => setFolderFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                folderFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
          />
        </div>
      </div>

      {/* File Grid */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Files className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No files uploaded yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {files.length === 0
              ? 'Upload specifications, PDFs, images, or link external assets to any project.'
              : 'No files match your search or folder filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => {
            const proj = projects.find((p) => p.id === file.projectId);
            const uploader = users.find((u) => u.id === file.uploadedBy);
            const canDelete = currentUser?.id === file.uploadedBy || isAdmin || isSuperAdmin;

            return (
              <div
                key={file.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-mono-tabular">
                    <span className="font-semibold text-slate-600 uppercase tracking-wider">{file.folder}</span>
                    <span>{file.size}</span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 truncate">{file.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Project: <strong>{proj?.name || 'Project'}</strong>
                  </p>
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
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => deleteFile(file.projectId, file.id, file.url)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete file"
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
  );
};
