import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  runTransaction,
  query, 
  where, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { Comment, Attachment } from '../../types';

export const commentService = {
  // Get comments for a specific target
  async getComments(projectId: string, targetType: Comment['targetType'], targetId: string): Promise<Comment[]> {
    const path = 'comments';
    try {
      const q = query(
        collection(db, path),
        where('projectId', '==', projectId),
        where('targetType', '==', targetType),
        where('targetId', '==', targetId)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Comment))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Add new comment (honors caller ID when provided so local & remote stay identical)
  async addComment(data: {
    id?: string;
    projectId: string;
    targetType: Comment['targetType'];
    targetId: string;
    userId: string;
    content: string;
    parentCommentId?: string | null;
    mentions?: string[];
    attachments?: Attachment[];
  }): Promise<Comment> {
    const commentId = data.id || `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const path = `comments/${commentId}`;

    const newComment: Comment = sanitizeForFirestore({
      id: commentId,
      projectId: data.projectId,
      targetType: data.targetType,
      targetId: data.targetId,
      userId: data.userId,
      content: data.content,
      parentCommentId: data.parentCommentId || null,
      mentions: data.mentions || [],
      attachments: data.attachments || [],
      reactions: {},
      createdAt: now,
      updatedAt: now
    });

    try {
      await setDoc(doc(db, 'comments', commentId), newComment);
      return newComment;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Toggle emoji reaction atomically using a Firestore transaction
  async toggleReaction(commentId: string, userId: string, emoji: string): Promise<void> {
    const path = `comments/${commentId}`;
    try {
      await runTransaction(db, async (tx) => {
        const commRef = doc(db, 'comments', commentId);
        const snap = await tx.get(commRef);
        if (!snap.exists()) return;
        const data = snap.data() as Comment;
        const reactions = { ...(data.reactions || {}) };
        const currentList = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
        const hasReacted = currentList.includes(userId);
        const updatedList = hasReacted
          ? currentList.filter((id) => id !== userId)
          : [...currentList, userId];

        if (updatedList.length > 0) {
          reactions[emoji] = updatedList;
        } else {
          delete reactions[emoji];
        }

        tx.update(commRef, {
          reactions,
          updatedAt: new Date().toISOString()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteComment(commentId: string): Promise<void> {
    const path = `comments/${commentId}`;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Listen to all comments for a project
  listenToProjectComments(projectId: string, callback: (comments: Comment[]) => void): Unsubscribe {
    const path = 'comments';
    const q = query(collection(db, path), where('projectId', '==', projectId));
    return onSnapshot(
      q,
      (snapshot) => {
        const comments = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Comment))
          .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        callback(comments);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  },

  // Listen to comments for a specific target
  listenToTargetComments(
    projectId: string,
    targetType: Comment['targetType'],
    targetId: string,
    callback: (comments: Comment[]) => void
  ): Unsubscribe {
    const path = 'comments';
    const q = query(
      collection(db, path),
      where('projectId', '==', projectId),
      where('targetType', '==', targetType),
      where('targetId', '==', targetId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const comments = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Comment))
          .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        callback(comments);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }
};
