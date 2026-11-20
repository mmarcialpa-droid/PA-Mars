import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  writeBatch,
  runTransaction,
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { Task, Attachment, ApprovalRecord } from '../../types';

const calcHours = (startIso: string, endIso: string): number => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round(((end - start) / 3600000) * 10) / 10);
};

export const taskService = {
  // Get tasks for a specific project
  async getProjectTasks(projectId: string): Promise<Task[]> {
    const path = `projects/${projectId}/tasks`;
    try {
      const snap = await getDocs(collection(db, 'projects', projectId, 'tasks'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Create a new task atomically in project subcollection & userTasks index
  async createTask(taskData: Partial<Task>, currentUserId: string): Promise<Task> {
    if (!taskData.projectId) {
      throw new Error('A valid projectId is required to create a task.');
    }
    const projectId = taskData.projectId;
    const taskId = taskData.id || `task_${Date.now()}`;
    const now = new Date().toISOString();
    const path = `projects/${projectId}/tasks/${taskId}`;

    const timestamps: Task['timestamps'] = {
      createdAt: now
    };
    if (taskData.status === 'in_progress') {
      timestamps.startedAt = now;
    }

    const newTask: Task = sanitizeForFirestore({
      id: taskId,
      projectId,
      title: taskData.title || 'New Task',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      createdBy: currentUserId,
      assignedUserIds: taskData.assignedUserIds && taskData.assignedUserIds.length > 0
        ? taskData.assignedUserIds
        : [currentUserId],
      dueDate: taskData.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      subtasks: taskData.subtasks || [],
      attachments: taskData.attachments || [],
      approvalHistory: [],
      timestamps,
      tatMetrics: {},
      tags: taskData.tags || []
    });

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'projects', projectId, 'tasks', taskId), newTask);

      for (const uid of newTask.assignedUserIds) {
        batch.set(doc(db, 'userTasks', uid, 'items', taskId), {
          projectId,
          taskId,
          title: newTask.title,
          status: newTask.status,
          priority: newTask.priority,
          dueDate: newTask.dueDate,
          updatedAt: now
        });
      }

      await batch.commit();
      return newTask;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Update task and keep denormalized userTasks synchronized
  async updateTask(projectId: string, taskId: string, updates: Partial<Task>): Promise<void> {
    const path = `projects/${projectId}/tasks/${taskId}`;
    const now = new Date().toISOString();
    const sanitizedUpdates = sanitizeForFirestore(updates);

    try {
      const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
      const existingSnap = await getDoc(taskRef);
      if (!existingSnap.exists()) {
        throw new Error(`Task ${taskId} does not exist.`);
      }
      const prevTask = existingSnap.data() as Task;
      const merged = { ...prevTask, ...sanitizedUpdates };

      const batch = writeBatch(db);
      batch.update(taskRef, sanitizedUpdates);

      // Clean up unassigned userTasks entries if assignees changed
      const prevAssignees = prevTask.assignedUserIds || [];
      const nextAssignees = merged.assignedUserIds || [];
      if (updates.assignedUserIds) {
        for (const oldUid of prevAssignees) {
          if (!nextAssignees.includes(oldUid)) {
            batch.delete(doc(db, 'userTasks', oldUid, 'items', taskId));
          }
        }
      }

      // Sync userTasks index if relevant fields updated
      if (
        updates.assignedUserIds ||
        updates.title !== undefined ||
        updates.status !== undefined ||
        updates.priority !== undefined ||
        updates.dueDate !== undefined
      ) {
        for (const uid of nextAssignees) {
          batch.set(
            doc(db, 'userTasks', uid, 'items', taskId),
            sanitizeForFirestore({
              projectId,
              taskId,
              title: merged.title,
              status: merged.status,
              priority: merged.priority,
              dueDate: merged.dueDate,
              updatedAt: now
            }),
            { merge: true }
          );
        }
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Delete task and userTasks index entries atomically
  async deleteTask(projectId: string, taskId: string, assignedUserIds: string[] = []): Promise<void> {
    const path = `projects/${projectId}/tasks/${taskId}`;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'projects', projectId, 'tasks', taskId));
      for (const uid of assignedUserIds) {
        batch.delete(doc(db, 'userTasks', uid, 'items', taskId));
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Start task workflow action (transactional)
  async startTask(projectId: string, taskId: string): Promise<void> {
    const path = `projects/${projectId}/tasks/${taskId}`;
    const now = new Date().toISOString();
    try {
      await runTransaction(db, async (tx) => {
        const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
        const snap = await tx.get(taskRef);
        if (!snap.exists()) return;
        const task = snap.data() as Task;

        const startedAt = task.timestamps?.startedAt || now;
        const creationToStartHours = task.tatMetrics?.creationToStartHours ?? calcHours(task.timestamps.createdAt, startedAt);

        tx.update(taskRef, {
          status: 'in_progress',
          'timestamps.startedAt': startedAt,
          'tatMetrics.creationToStartHours': creationToStartHours
        });

        for (const uid of task.assignedUserIds || []) {
          tx.set(doc(db, 'userTasks', uid, 'items', taskId), {
            projectId,
            taskId,
            status: 'in_progress',
            updatedAt: now
          }, { merge: true });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Submit for approval (transactional, computes first submission TAT & revision duration)
  async submitForApproval(
    projectId: string, 
    taskId: string, 
    userId: string, 
    remarks: string, 
    attachments: Attachment[] = []
  ): Promise<void> {
    const path = `projects/${projectId}/tasks/${taskId}`;
    const now = new Date().toISOString();
    try {
      await runTransaction(db, async (tx) => {
        const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
        const snap = await tx.get(taskRef);
        if (!snap.exists()) return;
        const task = snap.data() as Task;

        const round = (task.approvalHistory?.length || 0) + 1;
        const newRecord: ApprovalRecord = sanitizeForFirestore({
          id: `appr_${Date.now()}`,
          round,
          submittedBy: userId,
          submittedAt: now,
          designerRemarks: remarks,
          submissionAttachments: attachments,
          status: 'pending'
        });

        const isInitial = !task.timestamps?.initialSubmittedAt;
        const startIso = task.timestamps?.startedAt || task.timestamps?.createdAt || now;
        const startToFirstSubmissionHours = isInitial
          ? calcHours(startIso, now)
          : task.tatMetrics?.startToFirstSubmissionHours;

        const revisionDurationHours = !isInitial && task.timestamps?.revisionRequestedAt
          ? calcHours(task.timestamps.revisionRequestedAt, now)
          : task.tatMetrics?.revisionDurationHours;

        const updatePayload: Record<string, unknown> = {
          status: 'for_approval',
          approvalHistory: [...(task.approvalHistory || []), newRecord],
          'timestamps.initialSubmittedAt': task.timestamps?.initialSubmittedAt || now
        };

        if (!isInitial) {
          updatePayload['timestamps.resubmittedAt'] = now;
        }
        if (startToFirstSubmissionHours !== undefined) {
          updatePayload['tatMetrics.startToFirstSubmissionHours'] = startToFirstSubmissionHours;
        }
        if (revisionDurationHours !== undefined) {
          updatePayload['tatMetrics.revisionDurationHours'] = revisionDurationHours;
        }

        tx.update(taskRef, updatePayload);

        for (const uid of task.assignedUserIds || []) {
          tx.set(doc(db, 'userTasks', uid, 'items', taskId), {
            projectId,
            taskId,
            status: 'for_approval',
            updatedAt: now
          }, { merge: true });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Request revision (transactional)
  async requestRevision(projectId: string, taskId: string, reviewerId: string, notes: string): Promise<void> {
    const path = `projects/${projectId}/tasks/${taskId}`;
    const now = new Date().toISOString();
    try {
      await runTransaction(db, async (tx) => {
        const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
        const snap = await tx.get(taskRef);
        if (!snap.exists()) return;
        const task = snap.data() as Task;

        const history = [...(task.approvalHistory || [])];
        const lastIdx = history.length - 1;
        let approvalTurnaroundHours = task.tatMetrics?.approvalTurnaroundHours;

        if (lastIdx >= 0) {
          const updatedLast = {
            ...history[lastIdx],
            status: 'revision_requested' as const,
            reviewedBy: reviewerId,
            reviewedAt: now,
            revisionNotes: notes
          };
          history[lastIdx] = updatedLast;
          approvalTurnaroundHours = calcHours(updatedLast.submittedAt, now);
        }

        const updatePayload: Record<string, unknown> = {
          status: 'for_revision',
          approvalHistory: history,
          'timestamps.revisionRequestedAt': now
        };
        if (approvalTurnaroundHours !== undefined) {
          updatePayload['tatMetrics.approvalTurnaroundHours'] = approvalTurnaroundHours;
        }

        tx.update(taskRef, updatePayload);

        for (const uid of task.assignedUserIds || []) {
          tx.set(doc(db, 'userTasks', uid, 'items', taskId), {
            projectId,
            taskId,
            status: 'for_revision',
            updatedAt: now
          }, { merge: true });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Approve task (transactional)
  async approveTask(projectId: string, taskId: string, reviewerId: string): Promise<void> {
    const path = `projects/${projectId}/tasks/${taskId}`;
    const now = new Date().toISOString();
    try {
      await runTransaction(db, async (tx) => {
        const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
        const snap = await tx.get(taskRef);
        if (!snap.exists()) return;
        const task = snap.data() as Task;

        const history = [...(task.approvalHistory || [])];
        const lastIdx = history.length - 1;
        let approvalTurnaroundHours = task.tatMetrics?.approvalTurnaroundHours;

        if (lastIdx >= 0) {
          const updatedLast = {
            ...history[lastIdx],
            status: 'approved' as const,
            reviewedBy: reviewerId,
            reviewedAt: now
          };
          history[lastIdx] = updatedLast;
          approvalTurnaroundHours = calcHours(updatedLast.submittedAt, now);
        }

        const startIso = task.timestamps?.startedAt || task.timestamps?.createdAt || now;
        const totalCompletionHours = calcHours(startIso, now);

        const updatePayload: Record<string, unknown> = {
          status: 'completed',
          approvalHistory: history,
          'timestamps.approvedAt': now,
          'timestamps.completedAt': now,
          'tatMetrics.totalCompletionHours': totalCompletionHours
        };
        if (approvalTurnaroundHours !== undefined) {
          updatePayload['tatMetrics.approvalTurnaroundHours'] = approvalTurnaroundHours;
        }

        tx.update(taskRef, updatePayload);

        for (const uid of task.assignedUserIds || []) {
          tx.set(doc(db, 'userTasks', uid, 'items', taskId), {
            projectId,
            taskId,
            status: 'completed',
            updatedAt: now
          }, { merge: true });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Listen to project tasks
  listenToProjectTasks(projectId: string, callback: (tasks: Task[]) => void): Unsubscribe {
    const path = `projects/${projectId}/tasks`;
    return onSnapshot(
      collection(db, 'projects', projectId, 'tasks'),
      (snapshot) => {
        const tasks = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Task))
          .sort((a, b) => (b.timestamps?.createdAt || '').localeCompare(a.timestamps?.createdAt || ''));
        callback(tasks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }
};
