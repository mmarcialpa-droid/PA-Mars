import {
  collection,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { ActivityItem } from '../../types';

export const activityService = {
  async logActivity(activity: ActivityItem): Promise<void> {
    const path = `projects/${activity.projectId}/activities/${activity.id}`;
    try {
      await setDoc(
        doc(db, 'projects', activity.projectId, 'activities', activity.id),
        sanitizeForFirestore(activity)
      );
    } catch (error) {
      console.warn('Activity log write skipped:', error);
    }
  },

  listenToProjectActivities(projectId: string, callback: (activities: ActivityItem[]) => void): Unsubscribe {
    const path = `projects/${projectId}/activities`;
    const q = query(
      collection(db, 'projects', projectId, 'activities'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityItem));
        callback(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }
};
