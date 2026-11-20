import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { ScheduleEvent } from '../../types';

export const scheduleService = {
  async createEvent(data: Omit<ScheduleEvent, 'id'> & { id?: string }): Promise<ScheduleEvent> {
    const eventId = data.id || `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const path = `projects/${data.projectId}/events/${eventId}`;

    const newEvent: ScheduleEvent = sanitizeForFirestore({
      id: eventId,
      projectId: data.projectId,
      title: data.title,
      description: data.description || '',
      type: data.type || 'meeting',
      date: data.date,
      time: data.time || '',
      attendeeIds: data.attendeeIds || []
    });

    try {
      await setDoc(doc(db, 'projects', data.projectId, 'events', eventId), newEvent);
      return newEvent;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async updateEvent(projectId: string, eventId: string, updates: Partial<ScheduleEvent>): Promise<void> {
    const path = `projects/${projectId}/events/${eventId}`;
    try {
      await updateDoc(doc(db, 'projects', projectId, 'events', eventId), sanitizeForFirestore(updates));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteEvent(projectId: string, eventId: string): Promise<void> {
    const path = `projects/${projectId}/events/${eventId}`;
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'events', eventId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  listenToProjectEvents(projectId: string, callback: (events: ScheduleEvent[]) => void): Unsubscribe {
    const path = `projects/${projectId}/events`;
    return onSnapshot(
      collection(db, 'projects', projectId, 'events'),
      (snapshot) => {
        const events = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as ScheduleEvent))
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        callback(events);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }
};
