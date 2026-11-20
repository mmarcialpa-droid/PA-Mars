import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { Discussion } from '../../types';

export const discussionService = {
  // Get discussions for a project
  async getProjectDiscussions(projectId: string): Promise<Discussion[]> {
    const path = `projects/${projectId}/discussions`;
    try {
      const snap = await getDocs(collection(db, 'projects', projectId, 'discussions'));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Discussion))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Create discussion
  async createDiscussion(data: Partial<Discussion>, authorId: string): Promise<Discussion> {
    if (!data.projectId) {
      throw new Error('A valid projectId is required to post a discussion.');
    }
    const projectId = data.projectId;
    const discId = data.id || `disc_${Date.now()}`;
    const now = new Date().toISOString();
    const path = `projects/${projectId}/discussions/${discId}`;

    const newDisc: Discussion = sanitizeForFirestore({
      id: discId,
      projectId,
      title: data.title || 'Untitled Discussion',
      content: data.content || '',
      authorId,
      category: data.category || 'discussion',
      pinned: !!data.pinned,
      createdAt: now,
      updatedAt: now,
      attachments: data.attachments || []
    });

    try {
      await setDoc(doc(db, 'projects', projectId, 'discussions', discId), newDisc);
      return newDisc;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Toggle pin
  async togglePin(projectId: string, discId: string, currentPinned: boolean): Promise<void> {
    const path = `projects/${projectId}/discussions/${discId}`;
    try {
      await updateDoc(doc(db, 'projects', projectId, 'discussions', discId), {
        pinned: !currentPinned,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Delete discussion
  async deleteDiscussion(projectId: string, discId: string): Promise<void> {
    const path = `projects/${projectId}/discussions/${discId}`;
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'discussions', discId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Listen to discussions
  listenToDiscussions(projectId: string, callback: (discussions: Discussion[]) => void): Unsubscribe {
    const path = `projects/${projectId}/discussions`;
    return onSnapshot(
      collection(db, 'projects', projectId, 'discussions'),
      (snapshot) => {
        const discs = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Discussion))
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          });
        callback(discs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }
};
