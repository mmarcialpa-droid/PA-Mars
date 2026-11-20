import React, { useState, useRef } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Paperclip,
  Calendar,
  Tag,
  RotateCcw,
  Play,
  ExternalLink,
  Upload,
  Edit2,
  Trash2,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskStatus, TaskPriority, Attachment } from '../../types';
import { CommentThread } from '../collaboration/CommentThread';
import { fileService } from '../../services/files/fileService';

export const TaskDetailModal: React.FC = () => {
  const {
    selectedTaskId,
    setSelectedTaskId,
    tasks,
    projects,
    users,
    currentUser,
    updateTask,
    deleteTask,
    moveTaskStatus,
    startTask,
    submitTaskForApproval,
    requestTaskRevision,
    approveTask,
    isApproverForProject,
    hasPermission,
    isAdmin,
    isSuperAdmin,
    showToast
  } = useApp();

  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [designerRemarks, setDesignerRemarks] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState<Attachment[]>([]);
  const [uploadingSubFile, setUploadingSubFile] = useState(false);
  const [uploadSubPct, setUploadSubPct] = useState(0);
  const submissionFileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadingTaskFile, setUploadingTaskFile] = useState(false);
  const taskFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isRequestingRevision, setIsRequestingRevision] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Inline Edit Mode
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssignees, setEditAssignees] = useState<string[]>([]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!selectedTaskId) return null;

  const task = tasks.find((t) => t.id === selectedTaskId);
  if (!task) return null;

  const project = projects.find((p) => p.id === task.projectId);
  const assignees = users.filter((u) => task.assignedUserIds.includes(u.id));
  const isApprover = isApproverForProject(task.projectId);
  const canEdit =
    isSuperAdmin ||
    isAdmin ||
    hasPermission('edit_tasks') ||
    task.createdBy === currentUser?.id ||
    task.assignedUserIds.includes(currentUser?.id || '');
  const canDelete = isSuperAdmin || isAdmin || hasPermission('delete_tasks') || task.createdBy === currentUser?.id;

  const statusLabels: Record<TaskStatus, { label: string; bg: string; text: string }> = {
    todo: { label: 'To Do', bg: 'bg-slate-100', text: 'text-slate-700' },
    in_progress: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-800' },
    pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800' },
    for_revision: { label: 'For Revision', bg: 'bg-orange-100', text: 'text-orange-800' },
    for_approval: { label: 'For Approval', bg: 'bg-amber-100', text: 'text-amber-800' },
    completed: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-800' }
  };

  const priorityLabels: Record<TaskPriority, { label: string; color: string }> = {
    low: { label: 'Low', color: 'text-slate-500' },
    medium: { label: 'Medium', color: 'text-blue-600' },
    high: { label: 'High', color: 'text-amber-600' },
    urgent: { label: 'Urgent', color: 'text-rose-600' }
  };

  const startEditing = () => {
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate);
    setEditAssignees(task.assignedUserIds || []);
    setIsEditingTask(true);
  };

  const handleSaveTaskEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setActionLoading(true);
    try {
      await updateTask(task.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        priority: editPriority,
        dueDate: editDueDate,
        assignedUserIds: editAssignees
      });
      setIsEditingTask(false);
      showToast('success', 'Task details saved.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAssigneeEdit = (uid: string) => {
    setEditAssignees((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleDeleteConfirm = async () => {
    setActionLoading(true);
    try {
      await deleteTask(task.id);
      setConfirmDelete(false);
      setSelectedTaskId(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    const updated = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s));
    await updateTask(task.id, { subtasks: updated });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newSub = {
      id: `sub_${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false
    };

    await updateTask(task.id, { subtasks: [...task.subtasks, newSub] });
    setNewSubtaskTitle('');
  };

  const handleTaskAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploadingTaskFile(true);
    try {
      const att = await fileService.uploadAttachment(task.projectId, file, currentUser.id);
      await updateTask(task.id, { attachments: [...(task.attachments || []), att] });
      showToast('success', `Attached "${att.name}" to task.`);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Attachment upload failed.');
    } finally {
      setUploadingTaskFile(false);
      if (taskFileInputRef.current) taskFileInputRef.current.value = '';
    }
  };

  const handleSubmissionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploadingSubFile(true);
    setUploadSubPct(0);
    try {
      const att = await fileService.uploadAttachment(task.projectId, file, currentUser.id, setUploadSubPct);
      setSubmissionFiles((prev) => [...prev, att]);
      showToast('success', `Deliverable "${att.name}" uploaded.`);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Deliverable upload failed.');
    } finally {
      setUploadingSubFile(false);
      if (submissionFileInputRef.current) submissionFileInputRef.current.value = '';
    }
  };

  const handleConfirmSubmission = async () => {
    if (!designerRemarks.trim()) return;
    setActionLoading(true);
    try {
      const combinedAttachments: Attachment[] = [...submissionFiles];
      if (attachmentName.trim()) {
        const val = attachmentName.trim();
        const isUrl = /^https?:\/\//i.test(val);
        combinedAttachments.push({
          id: `att_${Date.now()}`,
          name: isUrl ? val.split('/').pop() || 'External Link' : val,
          url: isUrl ? val : '#',
          size: isUrl ? 'Link' : 'Reference',
          type: isUrl ? 'link' : 'reference',
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUser?.id || 'user'
        });
      }

      await submitTaskForApproval(task.id, designerRemarks.trim(), combinedAttachments);
      setIsSubmittingApproval(false);
      setDesignerRemarks('');
      setAttachmentName('');
      setSubmissionFiles([]);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRevision = async () => {
    if (!revisionNotes.trim()) return;
    setActionLoading(true);
    try {
      await requestTaskRevision(task.id, revisionNotes.trim());
      setIsRequestingRevision(false);
      setRevisionNotes('');
    } finally {
      setActionLoading(false);
    }
  };

  const renderAttachmentLink = (att: Attachment) => {
    const hasValidUrl = att.url && att.url !== '#';
    const isImage = att.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.name);
    return (
      <div
        key={att.id}
        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasValidUrl && isImage && (
            <img src={att.url} alt={att.name} className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0" />
          )}
          <div className="truncate">
            <div className="font-semibold text-slate-800 truncate">{att.name}</div>
            <div className="text-[10px] text-slate-400">
              {att.size} · {users.find((u) => u.id === att.uploadedBy)?.name || 'Team'}
            </div>
          </div>
        </div>
        {hasValidUrl ? (
          <a
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded shrink-0"
            title="Open attachment"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <span className="text-[10px] text-slate-400 font-mono shrink-0">Ref only</span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={() => setSelectedTaskId(null)} />

      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-2 text-xs min-w-0">
            {project && (
              <span className="flex items-center gap-1.5 font-medium text-slate-600 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                <span className="truncate">{project.name}</span>
              </span>
            )}
            <span className="text-slate-300">/</span>
            <span className="font-mono-tabular text-slate-400 truncate">ID: {task.id}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canEdit && !isEditingTask && (
              <button
                type="button"
                onClick={startEditing}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                title="Edit Task Details"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setSelectedTaskId(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title & Details (View or Inline Edit) */}
          {isEditingTask ? (
            <form onSubmit={handleSaveTaskEdits} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assignees</label>
                <div className="flex flex-wrap gap-1.5">
                  {users.map((u) => {
                    const selected = editAssignees.includes(u.id);
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => handleToggleAssigneeEdit(u.id)}
                        className={`px-2 py-1 rounded-md border text-[11px] flex items-center gap-1 ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        <span>{u.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditingTask(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !editTitle.trim()}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${statusLabels[task.status].bg} ${statusLabels[task.status].text}`}>
                  {statusLabels[task.status].label}
                </span>
                <span className={`text-xs font-semibold flex items-center gap-1 ${priorityLabels[task.priority].color}`}>
                  <Tag className="w-3.5 h-3.5" />
                  Priority: {priorityLabels[task.priority].label}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500 font-mono-tabular flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Due: {task.dueDate}
                </span>
                {assignees.length > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span>Assigned:</span>
                      <span className="font-semibold text-slate-800">{assignees.map((a) => a.name).join(', ')}</span>
                    </span>
                  </>
                )}
              </div>

              <h2 className="text-xl font-bold font-display text-slate-900 leading-snug">
                {task.title}
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">
                {task.description || 'No detailed description provided.'}
              </p>
            </div>
          )}

          {/* Workflow Action Bar (MARS Task Engine) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                MARS WORKFLOW ACTIONS
              </span>
              <span className="text-[11px] text-slate-500">
                Current Status: <strong>{statusLabels[task.status].label}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {task.status === 'todo' && (
                <button
                  onClick={() => startTask(task.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Task</span>
                </button>
              )}

              {(task.status === 'in_progress' || task.status === 'for_revision' || task.status === 'todo') && (
                <button
                  onClick={() => setIsSubmittingApproval(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{task.approvalHistory?.length > 0 ? 'Resubmit for Approval' : 'Submit for Approval'}</span>
                </button>
              )}

              {task.status === 'for_approval' && (
                <div className="flex items-center gap-2">
                  {isApprover ? (
                    <>
                      <button
                        onClick={() => approveTask(task.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Complete Task</span>
                      </button>

                      <button
                        onClick={() => setIsRequestingRevision(true)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 transition-colors shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Request Revision</span>
                      </button>
                    </>
                  ) : (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>In Approval Queue. Waiting for Project Approver or Admin review.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Status Override Dropdown (Permission-gated for approval states) */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Quick Change:</span>
                <select
                  value={task.status}
                  onChange={(e) => moveTaskStatus(task.id, e.target.value as TaskStatus)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 outline-hidden focus:border-slate-400"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending">Pending</option>
                  <option value="for_revision" disabled={!isApprover}>
                    For Revision {!isApprover ? '(Approver only)' : ''}
                  </option>
                  <option value="for_approval">For Approval</option>
                  <option value="completed" disabled={!isApprover}>
                    Completed {!isApprover ? '(Approver only)' : ''}
                  </option>
                </select>
              </div>
            </div>

            {/* Submission Form Drawer */}
            {isSubmittingApproval && (
              <div className="mt-4 p-4 bg-white border border-amber-200 rounded-lg shadow-sm space-y-3">
                <div className="text-xs font-bold text-slate-900">
                  Submit Task for Approval (Round {(task.approvalHistory?.length || 0) + 1})
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Designer Remarks / Summary of Deliverables *
                  </label>
                  <textarea
                    value={designerRemarks}
                    onChange={(e) => setDesignerRemarks(e.target.value)}
                    placeholder="Describe what was accomplished, links to design files, and notes for the approver..."
                    rows={3}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-medium text-slate-600">
                      Attach Deliverable File or Reference URL
                    </label>
                    <input
                      ref={submissionFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleSubmissionFileUpload}
                    />
                    <button
                      type="button"
                      disabled={uploadingSubFile}
                      onClick={() => submissionFileInputRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-semibold"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{uploadingSubFile ? `Uploading ${uploadSubPct}%...` : 'Upload Deliverable'}</span>
                    </button>
                  </div>

                  {submissionFiles.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {submissionFiles.map((f) => renderAttachmentLink(f))}
                    </div>
                  )}

                  <input
                    type="text"
                    value={attachmentName}
                    onChange={(e) => setAttachmentName(e.target.value)}
                    placeholder="Optional Figma / external link URL or filename"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSubmittingApproval(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSubmission}
                    disabled={actionLoading || uploadingSubFile || !designerRemarks.trim()}
                    className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors disabled:opacity-40"
                  >
                    {actionLoading ? 'Submitting...' : 'Send to Approval Queue'}
                  </button>
                </div>
              </div>
            )}

            {/* Revision Request Drawer */}
            {isRequestingRevision && (
              <div className="mt-4 p-4 bg-white border border-orange-200 rounded-lg shadow-sm space-y-3">
                <div className="text-xs font-bold text-slate-900">
                  Request Task Revision
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Revision Notes & Required Modifications *
                  </label>
                  <textarea
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="Specify the exact feedback, accessibility issues, or changes required..."
                    rows={3}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-slate-400"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestingRevision(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRevision}
                    disabled={actionLoading || !revisionNotes.trim()}
                    className="px-4 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 transition-colors disabled:opacity-40"
                  >
                    {actionLoading ? 'Sending...' : 'Send Revision Request'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Turnaround Time (TAT) Monitoring Breakdown */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                TURNAROUND TIME (TAT) MONITORING
              </span>
              <span className="text-[11px] font-normal text-slate-500 font-mono-tabular">
                Created: {new Date(task.timestamps.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Creation → Start</span>
                <span className="font-mono-tabular font-bold text-sm text-slate-900">
                  {task.tatMetrics?.creationToStartHours !== undefined ? `${task.tatMetrics.creationToStartHours}h` : 'Pending'}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Start → First Submit</span>
                <span className="font-mono-tabular font-bold text-sm text-slate-900">
                  {task.tatMetrics?.startToFirstSubmissionHours !== undefined ? `${task.tatMetrics.startToFirstSubmissionHours}h` : 'Pending'}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Revision TAT</span>
                <span className="font-mono-tabular font-bold text-sm text-orange-600">
                  {task.tatMetrics?.revisionDurationHours !== undefined ? `${task.tatMetrics.revisionDurationHours}h` : '—'}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Approval TAT</span>
                <span className="font-mono-tabular font-bold text-sm text-slate-900">
                  {task.tatMetrics?.approvalTurnaroundHours !== undefined ? `${task.tatMetrics.approvalTurnaroundHours}h` : 'Pending'}
                </span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Total Completion</span>
                <span className="font-mono-tabular font-bold text-sm text-slate-900">
                  {task.tatMetrics?.totalCompletionHours !== undefined
                    ? `${task.tatMetrics.totalCompletionHours}h`
                    : task.status === 'completed'
                    ? 'Done'
                    : 'In Progress'}
                </span>
              </div>
            </div>
          </div>

          {/* Approval Rounds History */}
          {task.approvalHistory && task.approvalHistory.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>APPROVAL ROUNDS HISTORY ({task.approvalHistory.length})</span>
              </div>

              <div className="space-y-3">
                {task.approvalHistory.map((rec) => {
                  const submitter = users.find((u) => u.id === rec.submittedBy);
                  const reviewer = users.find((u) => u.id === rec.reviewedBy);
                  return (
                    <div key={rec.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          Round {rec.round}: Submitted by {submitter?.name || 'Designer'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          rec.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          rec.status === 'revision_requested' ? 'bg-orange-100 text-orange-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {rec.status === 'approved' ? 'Approved' :
                           rec.status === 'revision_requested' ? 'Revision Requested' : 'Pending Review'}
                        </span>
                      </div>
                      <p className="text-slate-700 italic">"{rec.designerRemarks}"</p>

                      {rec.submissionAttachments && rec.submissionAttachments.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {rec.submissionAttachments.map((att) => renderAttachmentLink(att))}
                        </div>
                      )}

                      {rec.reviewedBy && (
                        <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                          <strong>Reviewed by {reviewer?.name || 'Approver'}:</strong>{' '}
                          {rec.revisionNotes ? rec.revisionNotes : 'Approved with zero remarks.'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subtasks Checklist */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900">
                CHECKLIST / SUBTASKS ({task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length})
              </span>
            </div>

            <div className="space-y-2 mb-3">
              {task.subtasks.map((sub) => (
                <label key={sub.id} className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sub.completed}
                    onChange={() => handleToggleSubtask(sub.id)}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300"
                  />
                  <span className={sub.completed ? 'line-through text-slate-400' : 'text-slate-800'}>
                    {sub.title}
                  </span>
                </label>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add a new checklist item..."
                className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 outline-hidden focus:border-slate-400"
              />
              <button
                type="submit"
                disabled={!newSubtaskTitle.trim()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </form>
          </div>

          {/* Attachments */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                <span>ATTACHMENTS ({(task.attachments || []).length})</span>
              </div>
              <input
                ref={taskFileInputRef}
                type="file"
                className="hidden"
                onChange={handleTaskAttachmentUpload}
              />
              <button
                type="button"
                disabled={uploadingTaskFile}
                onClick={() => taskFileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold"
              >
                <Upload className="w-3 h-3" />
                <span>{uploadingTaskFile ? 'Uploading...' : 'Add Attachment'}</span>
              </button>
            </div>

            {(task.attachments || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic">No files attached to this task yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {task.attachments.map((att) => renderAttachmentLink(att))}
              </div>
            )}
          </div>

          {/* Embedded Collaboration Comment Thread */}
          <CommentThread
            projectId={task.projectId}
            targetType="task"
            targetId={task.id}
            title="Task Discussion & Activity Stream"
          />
        </div>
      </div>

      {/* Delete Confirmation Overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Task</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Permanently delete <strong>"{task.title}"</strong>? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
