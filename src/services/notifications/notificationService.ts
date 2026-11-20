import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  writeBatch,
  query, 
  where, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { NotificationItem } from '../../types';

export const notificationService = {
  // Get user notifications
  async getUserNotifications(userId: string): Promise<NotificationItem[]> {
    const path = 'notifications';
    try {
      const q = query(collection(db, path), where('recipientId', '==', userId));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as NotificationItem))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Mark notification read
  async markAsRead(notificationId: string): Promise<void> {
    const path = `notifications/${notificationId}`;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Mark all unread notifications for user as read in a batch
  async markAllAsRead(userId: string, unreadIds: string[]): Promise<void> {
    if (unreadIds.length === 0) return;
    const path = 'notifications';
    try {
      const batch = writeBatch(db);
      for (const id of unreadIds) {
        batch.update(doc(db, 'notifications', id), { isRead: true });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path} (for ${userId})`);
    }
  },

  // Create notification
  async createNotification(notif: Omit<NotificationItem, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<NotificationItem> {
    const notifId = notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const path = `notifications/${notifId}`;
    const fullNotif: NotificationItem = sanitizeForFirestore({
      ...notif,
      id: notifId,
      createdAt: notif.createdAt || new Date().toISOString()
    });
    try {
      await setDoc(doc(db, 'notifications', notifId), fullNotif);
      return fullNotif;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Listen to user notifications
  listenToUserNotifications(userId: string, callback: (notifs: NotificationItem[]) => void): Unsubscribe {
    const path = 'notifications';
    const q = query(collection(db, path), where('recipientId', '==', userId));

    return onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as NotificationItem))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(notifs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }
};
