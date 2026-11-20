import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckSquare,
  FolderKanban,
  MessageSquare,
  FileText,
  Upload,
  AlertCircle,
  Link2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskPriority, Discussion } from '../../types';

export const QuickCreateModal: React.FC = () => {
  const {
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    quickCreateType,
    setQuickCreateType,
    projects,
    activeProjectId,
    users,
    currentUser,
    createTask,
    createProject,
    createDiscussion,
    uploadFile,
    setSelectedTaskId,
    setActiveProjectId,
    setActiveProjectTab,
    hasPermission,
    isAdmin,
    isSuperAdmin
  } = useApp();

  const [activeTab, setActiveTab] = useState<'task' | 'project' | 'discussion' | 'file'>(
    quickCreateType || 'task'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDueDate, setTaskDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [taskAssigneeId, setTaskAssigneeId] = useState('');

  // Project form state
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectColor, setProjectColor] = useState('#0284c7');
  const [projectCategory, setProjectCategory] = useState('Product Engineering');
  const [projectVisibility, setProjectVisibility] = useState<'public' | 'department' | 'private'>('public');
  const [projectTargetDate, setProjectTargetDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);

  // Discussion form state
  const [discTitle, setDiscTitle] = useState('');
  const [discProjectId, setDiscProjectId] = useState('');
  const [discContent, setDiscContent] = useState('');
  const [discCategory, setDiscCategory] = useState<Discussion['category']>('discussion');
  const [discPinned, setDiscPinned] = useState(false);

  // File form state
  const [fileName, setFileName] = useState('');
  const [fileProjectId, setFileProjectId] = useState('');
  const [fileFolder, setFileFolder] = useState('Specifications');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isQuickCreateOpen) return;
    setError(null);
    setUploadProgress(0);
    if (quickCreateType) {
      setActiveTab(quickCreateType);
    }
    const defaultProjId =
      (activeProjectId && projects.some((p) => p.id === activeProjectId) ? activeProjectId : '') ||
      projects[0]?.id ||
      '';
    setTaskProjectId((prev) => (prev && projects.some((p) => p.id === prev) ? prev : defaultProjId));
    setDiscProjectId((prev) => (prev && projects.some((p) => p.id === prev) ? prev : defaultProjId));
    setFileProjectId((prev) => (prev && projects.some((p) => p.id === prev) ? prev : defaultProjId));
    setTaskAssigneeId((prev) => prev || currentUser?.id || users[0]?.id || '');
  }, [isQuickCreateOpen, quickCreateType, activeProjectId, projects, currentUser, users]);

  if (!isQuickCreateOpen) return null;

  const currentTab = quickCreateType || activeTab;
  const canCreateProject = isSuperAdmin || isAdmin || hasPermission('create_projects');
  const canCreateTask = isSuperAdmin || isAdmin || hasPermission('create_tasks');

  const handleClose = () => {
    if (isSubmitting) return;
    setIsQuickCreateOpen(false);
    setError(null);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskProjectId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const newTask = await createTask({
        title: taskTitle.trim(),
        projectId: taskProjectId,
        description: taskDescription.trim(),
        priority: taskPriority,
        dueDate: taskDueDate,
        assignedUserIds: taskAssigneeId ? [taskAssigneeId] : []
      });

      setTaskTitle('');
      setTaskDescription('');
      setIsQuickCreateOpen(false);
      setSelectedTaskId(newTask.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const newProj = await createProject({
        name: projectName.trim(),
        description: projectDescription.trim(),
        color: projectColor,
        category: projectCategory,
        visibility: projectVisibility,
        targetDate: projectTargetDate
      });

      setProjectName('');
      setProjectDescription('');
      setIsQuickCreateOpen(false);
      setActiveProjectId(newProj.id);
      setActiveProjectTab('overview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discTitle.trim() || !discContent.trim() || !discProjectId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await createDiscussion({
        title: discTitle.trim(),
        projectId: discProjectId,
        content: discContent.trim(),
        category: discCategory,
        pinned: discPinned
      });

      setDiscTitle('');
      setDiscContent('');
      setDiscPinned(false);
      setIsQuickCreateOpen(false);
      setActiveProjectId(discProjectId);
      setActiveProjectTab('discussions');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post discussion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileProjectId) return;

    if (uploadMode === 'file' && !selectedFile) {
      setError('Please select a file from your device or switch to External Link mode.');
      return;
    }
    if (uploadMode === 'url' && !externalUrl.trim()) {
      setError('Please enter a valid external URL.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setUploadProgress(0);
    try {
      await uploadFile({
        projectId: fileProjectId,
        file: uploadMode === 'file' ? selectedFile : null,
        name: fileName.trim() || selectedFile?.name || 'Document',
        folder: fileFolder,
        url: uploadMode === 'url' ? externalUrl.trim() : undefined,
        type: uploadMode === 'url' ? 'link' : undefined,
        onProgress: (pct) => setUploadProgress(pct)
      });

      setFileName('');
      setSelectedFile(null);
      setExternalUrl('');
      setUploadProgress(0);
      setIsQuickCreateOpen(false);
      setActiveProjectId(fileProjectId);
      setActiveProjectTab('files');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload file.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const colorOptions = [
    { label: 'Sky', value: '#0284c7' },
    { label: 'Emerald', value: '#059669' },
    { label: 'Violet', value: '#7c3aed' },
    { label: 'Amber', value: '#d97706' },
    { label: 'Rose', value: '#e11d48' },
    { label: 'Slate', value: '#475569' }
  ];

  const NoProjectWarning = () => (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
      <p className="font-semibold">No project workspace exists yet.</p>
      <p className="text-[11px] text-amber-700">
        MARS organizes all tasks, discussions, and files inside projects. Create your first project first.
      </p>
      {canCreateProject && (
        <button
          type="button"
          onClick={() => {
            setQuickCreateType('project');
            setActiveTab('project');
          }}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs"
        >
          Switch to New Project
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={handleClose} />

      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setQuickCreateType('task');
                setActiveTab('task');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                currentTab === 'task' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Task</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickCreateType('project');
                setActiveTab('project');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                currentTab === 'project' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Project</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickCreateType('discussion');
                setActiveTab('discussion');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                currentTab === 'discussion' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discussion</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickCreateType('file');
                setActiveTab('file');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                currentTab === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>File</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* TASK FORM */}
          {currentTab === 'task' && (
            projects.length === 0 ? (
              <NoProjectWarning />
            ) : !canCreateTask ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                Your current role does not grant permission to create tasks.
              </div>
            ) : (
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Design checkout confirmation screen"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Project *
                    </label>
                    <select
                      value={taskProjectId}
                      onChange={(e) => setTaskProjectId(e.target.value)}
                      required
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assignee
                    </label>
                    <select
                      value={taskAssigneeId}
                      onChange={(e) => setTaskAssigneeId(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.title ? `(${u.title})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description & Deliverables
                  </label>
                  <textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Provide scope, assets, and requirements..."
                    rows={3}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !taskTitle.trim() || !taskProjectId}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    {isSubmitting ? 'Creating Task...' : 'Create Task'}
                  </button>
                </div>
              </form>
            )
          )}

          {/* PROJECT FORM */}
          {currentTab === 'project' && (
            !canCreateProject ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                Your current role does not grant permission to create projects.
              </div>
            ) : (
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Apollo Commerce Redesign"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="What is this project about? What is the main objective?"
                    rows={2}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={projectCategory}
                      onChange={(e) => setProjectCategory(e.target.value)}
                      placeholder="e.g. Mobile Apps"
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Visibility
                    </label>
                    <select
                      value={projectVisibility}
                      onChange={(e) => setProjectVisibility(e.target.value as any)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    >
                      <option value="public">Organization</option>
                      <option value="department">Department</option>
                      <option value="private">Private (Members)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Date
                    </label>
                    <input
                      type="date"
                      value={projectTargetDate}
                      onChange={(e) => setProjectTargetDate(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Color Theme
                  </label>
                  <div className="flex items-center gap-2">
                    {colorOptions.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setProjectColor(c.value)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          projectColor === c.value ? 'scale-125 ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !projectName.trim()}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    {isSubmitting ? 'Creating Project...' : 'Create Project Workspace'}
                  </button>
                </div>
              </form>
            )
          )}

          {/* DISCUSSION FORM */}
          {currentTab === 'discussion' && (
            projects.length === 0 ? (
              <NoProjectWarning />
            ) : (
              <form onSubmit={handleCreateDiscussion} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discussion Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={discTitle}
                    onChange={(e) => setDiscTitle(e.target.value)}
                    placeholder="e.g. Q4 Staging Freeze Date & Architecture Plan"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Project *
                    </label>
                    <select
                      value={discProjectId}
                      onChange={(e) => setDiscProjectId(e.target.value)}
                      required
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={discCategory}
                      onChange={(e) => setDiscCategory(e.target.value as Discussion['category'])}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    >
                      <option value="announcement">Announcement</option>
                      <option value="discussion">General Discussion</option>
                      <option value="question">Question</option>
                      <option value="update">Status Update</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Message Content *
                  </label>
                  <textarea
                    required
                    value={discContent}
                    onChange={(e) => setDiscContent(e.target.value)}
                    placeholder="Write message, post updates, ask questions..."
                    rows={4}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pinDiscussion"
                    checked={discPinned}
                    onChange={(e) => setDiscPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-slate-900 border-slate-300"
                  />
                  <label htmlFor="pinDiscussion" className="text-xs text-slate-700 font-medium">
                    Pin to top of project Message Board
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !discTitle.trim() || !discContent.trim() || !discProjectId}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    {isSubmitting ? 'Posting...' : 'Post to Message Board'}
                  </button>
                </div>
              </form>
            )
          )}

          {/* FILE FORM */}
          {currentTab === 'file' && (
            projects.length === 0 ? (
              <NoProjectWarning />
            ) : (
              <form onSubmit={handleUploadFile} className="space-y-4">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 ${
                      uploadMode === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File (Max 15MB)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('url')}
                    className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 ${
                      uploadMode === 'url' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link External Asset</span>
                  </button>
                </div>

                {uploadMode === 'file' ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setSelectedFile(f);
                        if (f && !fileName.trim()) {
                          setFileName(f.name);
                        }
                      }}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-5 border-2 border-dashed border-slate-300 hover:border-slate-500 rounded-xl text-center bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      <Upload className="w-7 h-7 text-slate-500 mx-auto mb-1.5" />
                      {selectedFile ? (
                        <div>
                          <p className="text-xs text-slate-900 font-bold">{selectedFile.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click to change file
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-slate-700 font-semibold">Click to select a file from your device</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            PDF, Office docs, Images (auto-optimized), Figma, Sketch, JSON, ZIP (max 15 MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      External Asset URL (Figma, Google Doc, Drive) *
                    </label>
                    <input
                      type="url"
                      required={uploadMode === 'url'}
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://www.figma.com/file/..."
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Document Title {uploadMode === 'url' ? '*' : '(Optional display name)'}
                  </label>
                  <input
                    type="text"
                    required={uploadMode === 'url'}
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="e.g. DesignTokens_v2.json or CheckoutFlow.pdf"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Project *
                    </label>
                    <select
                      value={fileProjectId}
                      onChange={(e) => setFileProjectId(e.target.value)}
                      required
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Folder
                    </label>
                    <select
                      value={fileFolder}
                      onChange={(e) => setFileFolder(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400 bg-white"
                    >
                      <option value="Specifications">Specifications</option>
                      <option value="Design Assets">Design Assets</option>
                      <option value="API Documentation">API Documentation</option>
                      <option value="Security & Compliance">Security & Compliance</option>
                      <option value="Meeting Notes">Meeting Notes</option>
                    </select>
                  </div>
                </div>

                {isSubmitting && uploadMode === 'file' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-slate-600">
                      <span>Uploading to Firebase Storage...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !fileProjectId ||
                      (uploadMode === 'file' ? !selectedFile : !externalUrl.trim() || !fileName.trim())
                    }
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    {isSubmitting ? 'Uploading...' : uploadMode === 'file' ? 'Upload to Project Files' : 'Save Asset Link'}
                  </button>
                </div>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
};
