import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { AuditLog, User } from '../../types';

export const auditService = {
  // Record an immutable security audit event
  async logEvent(
    organizationId: string,
    actor: User,
    action: string,
    targetType: AuditLog['targetType'],
    targetId: string,
    targetTitle: string,
    changes?: Record<string, any>
  ): Promise<void> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const auditEntry: AuditLog = sanitizeForFirestore({
      id: logId,
      organizationId,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action,
      targetType,
      targetId,
      targetTitle,
      changes: changes || {},
      createdAt: now
    });

    const path = `auditLogs/${logId}`;
    try {
      await setDoc(doc(db, 'auditLogs', logId), auditEntry);
    } catch (error) {
      console.warn('Audit logging failed (non-blocking):', error);
    }
  },

  // Get recent audit logs for an organization
  async getAuditLogs(organizationId: string, limitCount = 50): Promise<AuditLog[]> {
    const path = 'auditLogs';
    try {
      const q = query(
        collection(db, path),
        where('organizationId', '==', organizationId)
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => d.data() as AuditLog);
      return logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limitCount);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }
};
