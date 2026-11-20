import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  sanitizeForFirestore
} from '../firebase/firebase';
import {
  AuthPolicyState,
  EmailProviderStatus,
  Invitation,
  PasswordRecoveryRequest,
  RegistrationPolicy,
  RegistrationRequest,
  User,
  VerifiedInvitationSummary
} from '../../types';

export interface CreateAndSendInvitationPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string | null;
  positionId?: string | null;
  roleIds: string[];
  expirationDays?: number;
  allowDuplicate?: boolean;
  sendEmail?: boolean;
}

export interface InvitationDeliveryResponse {
  emailDelivered: boolean;
  invitationCode?: string;
  registrationUrl?: string;
  invitation: Invitation;
  errorCode?: string;
  message?: string;
  deliveryResult?: {
    provider: string;
    messageId: string;
    senderEmail: string;
    acceptedAt: string;
    deliveryNote: string;
  };
}

export class InvitationApiError extends Error {
  errorCode: string;
  statusCode: number;
  existingInvitationId?: string;
  retryAfterSeconds?: number;
  invitation?: Invitation;

  constructor(
    message: string,
    opts: {
      errorCode?: string;
      statusCode?: number;
      existingInvitationId?: string;
      retryAfterSeconds?: number;
      invitation?: Invitation;
    } = {}
  ) {
    super(message);
    this.name = 'InvitationApiError';
    this.errorCode = opts.errorCode || 'INVITATION_ERROR';
    this.statusCode = opts.statusCode || 500;
    this.existingInvitationId = opts.existingInvitationId;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.invitation = opts.invitation;
  }
}

async function getCallerIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  return user.getIdToken();
}

async function parseJsonPayload(res: Response, fallbackMessage: string): Promise<Record<string, any>> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {};
  } catch {
    if (!contentType.includes('application/json')) {
      throw new InvitationApiError(
        `${fallbackMessage} (unexpected non-JSON response from service, HTTP ${res.status}).`,
        { errorCode: 'INVALID_API_RESPONSE', statusCode: res.status || 502 }
      );
    }
    throw new InvitationApiError(fallbackMessage, {
      errorCode: 'INVALID_API_RESPONSE',
      statusCode: res.status || 502
    });
  }
}

export const userService = {
  // Get all users in an organization
  async getUsers(orgId: string): Promise<User[]> {
    const path = 'users';
    try {
      const q = query(collection(db, path), where('organizationId', '==', orgId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as User);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Listen to users in an organization in real time
  listenToUsers(orgId: string, callback: (users: User[]) => void): Unsubscribe {
    const path = 'users';
    const q = query(collection(db, path), where('organizationId', '==', orgId));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as User);
        callback(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  },

  // Get single user
  async getUser(userId: string): Promise<User | null> {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) return null;
      return snap.data() as User;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    }
  },

  // Update user profile or organizational assignments
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const path = `users/${userId}`;
    try {
      await updateDoc(
        doc(db, 'users', userId),
        sanitizeForFirestore({
          ...updates,
          updatedAt: new Date().toISOString()
        })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Delete Firestore user profile and associated registration requests
  async deleteUserProfile(userId: string): Promise<void> {
    const path = `users/${userId}`;
    try {
      await deleteDoc(doc(db, 'users', userId));
      const reqSnap = await getDocs(
        query(collection(db, 'registrationRequests'), where('userId', '==', userId))
      ).catch(() => null);
      if (reqSnap && !reqSnap.empty) {
        await Promise.all(reqSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Suspend user account
  async suspendUser(userId: string): Promise<void> {
    await this.updateUser(userId, { accountStatus: 'suspended' });
  },

  // Reactivate user account
  async reactivateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { accountStatus: 'active' });
  },

  // Listen to public registration requests queue (Admin only)
  listenToRegistrationRequests(
    orgId: string,
    callback: (requests: RegistrationRequest[]) => void
  ): Unsubscribe {
    const q = query(collection(db, 'registrationRequests'), where('organizationId', '==', orgId));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as RegistrationRequest)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(list);
      },
      (error) => {
        console.warn('Registration requests listener error:', error);
      }
    );
  },

  async updateRegistrationRequestStatus(
    userId: string,
    updates: Partial<RegistrationRequest>
  ): Promise<void> {
    try {
      const snap = await getDocs(
        query(collection(db, 'registrationRequests'), where('userId', '==', userId))
      );
      if (snap.empty) return;
      const nowIso = new Date().toISOString();
      await Promise.all(
        snap.docs.map((d) =>
          updateDoc(
            d.ref,
            sanitizeForFirestore({
              ...updates,
              updatedAt: nowIso
            })
          )
        )
      );
    } catch (err) {
      console.warn('Could not sync registrationRequests status:', err);
    }
  },

  // Listen to administrator-assisted password recovery requests (Admin only)
  listenToPasswordRecoveryRequests(
    callback: (requests: PasswordRecoveryRequest[]) => void
  ): Unsubscribe {
    return onSnapshot(
      collection(db, 'passwordRecoveryRequests'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as PasswordRecoveryRequest)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(list);
      },
      (error) => {
        console.warn('Password recovery requests listener error:', error);
      }
    );
  },

  async resolvePasswordRecoveryRequest(
    requestId: string,
    updates: {
      status: 'approved' | 'resolved' | 'dismissed';
      resolutionNote?: string | null;
      resolvedBy: string;
      resolvedByName: string;
    }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const path = `passwordRecoveryRequests/${requestId}`;
    try {
      await updateDoc(
        doc(db, 'passwordRecoveryRequests', requestId),
        sanitizeForFirestore({
          status: updates.status,
          resolutionNote: updates.resolutionNote || null,
          resolvedBy: updates.resolvedBy,
          resolvedByName: updates.resolvedByName,
          resolvedAt: nowIso,
          updatedAt: nowIso
        })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Inspect backend email provider readiness (optional)
  async getEmailProviderStatus(
    orgId?: string | null,
    gmailAccessToken?: string | null
  ): Promise<EmailProviderStatus> {
    const headers: Record<string, string> = {};
    if (auth.currentUser && orgId) {
      headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    }
    if (gmailAccessToken) {
      headers['X-Gmail-Access-Token'] = gmailAccessToken;
    }
    const queryStr = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : '';
    const res = await fetch(`/api/email/status${queryStr}`, { headers });
    if (!res.ok) {
      return {
        defaultProvider: 'resend',
        activeProvider: 'resend',
        activeProviderConfigured: false,
        activeSenderAddress: null,
        activeStatusMessage: 'Optional email notifications not configured (in-app invitation code generation active).',
        allowFallback: false,
        fallbackProvider: null,
        gmailOAuthSupported: true,
        providers: {
          resend: {
            provider: 'resend',
            label: 'Resend API (Default)',
            description: 'Optional transactional emails via Resend REST API.',
            configured: false,
            requiredEnvVars: ['RESEND_API_KEY', 'RESEND_FROM'],
            missingEnvVars: ['RESEND_API_KEY', 'RESEND_FROM'],
            senderAddress: null,
            statusMessage: 'Not configured (optional).'
          },
          gmail_oauth: {
            provider: 'gmail_oauth',
            label: 'Gmail OAuth 2.0',
            description: 'Optional user-authorized Google Workspace Gmail delivery.',
            configured: Boolean(gmailAccessToken),
            requiredEnvVars: [],
            missingEnvVars: [],
            senderAddress: null,
            statusMessage: 'Optional Gmail delivery.'
          },
          smtp: {
            provider: 'smtp',
            label: 'Custom SMTP',
            description: 'Optional authenticated SMTP relay.',
            configured: false,
            requiredEnvVars: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
            missingEnvVars: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
            senderAddress: null,
            statusMessage: 'Not configured (optional).'
          }
        },
        serverProviders: { resend: false, smtp: false },
        defaultServerProvider: null
      };
    }
    return (await res.json()) as EmailProviderStatus;
  },

  // Create cryptographic invitation on backend (works with OR without external email service)
  async createAndSendInvitation(
    orgId: string,
    data: CreateAndSendInvitationPayload,
    gmailAccessToken?: string | null
  ): Promise<InvitationDeliveryResponse> {
    const idToken = await getCallerIdToken();
    const res = await fetch('/api/invitations/create-and-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(gmailAccessToken ? { 'X-Gmail-Access-Token': gmailAccessToken } : {})
      },
      body: JSON.stringify({
        organizationId: orgId,
        ...data
      })
    });

    const body = await parseJsonPayload(res, 'Failed to generate invitation.');
    if (!res.ok) {
      throw new InvitationApiError(
        body?.message || 'Failed to generate invitation.',
        {
          errorCode: body?.errorCode,
          statusCode: res.status,
          existingInvitationId: body?.existingInvitationId,
          retryAfterSeconds: body?.retryAfterSeconds,
          invitation: body?.invitation
        }
      );
    }

    if (!body?.invitation?.id) {
      throw new InvitationApiError('Invitation service returned an incomplete invitation record.', {
        errorCode: 'INVALID_INVITATION_PAYLOAD',
        statusCode: 502
      });
    }

    return body as InvitationDeliveryResponse;
  },

  // Rotate cryptographic invitation code & optionally dispatch email
  async resendInvitation(
    orgId: string,
    invitationId: string,
    gmailAccessToken?: string | null
  ): Promise<InvitationDeliveryResponse> {
    const idToken = await getCallerIdToken();
    const res = await fetch('/api/invitations/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(gmailAccessToken ? { 'X-Gmail-Access-Token': gmailAccessToken } : {})
      },
      body: JSON.stringify({
        organizationId: orgId,
        invitationId
      })
    });

    const body = await parseJsonPayload(res, 'Could not regenerate invitation code.');
    if (!res.ok) {
      throw new InvitationApiError(
        body?.message || 'Could not regenerate invitation code.',
        {
          errorCode: body?.errorCode,
          statusCode: res.status,
          retryAfterSeconds: body?.retryAfterSeconds,
          invitation: body?.invitation
        }
      );
    }

    if (!body?.invitation?.id) {
      throw new InvitationApiError('Invitation service returned an incomplete invitation record.', {
        errorCode: 'INVALID_INVITATION_PAYLOAD',
        statusCode: 502
      });
    }

    return body as InvitationDeliveryResponse;
  },

  // Revoke invitation and invalidate hash lookup
  async revokeInvitation(orgId: string, invitationId: string): Promise<Invitation> {
    const idToken = await getCallerIdToken();
    const res = await fetch('/api/invitations/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ organizationId: orgId, invitationId })
    });

    const body = await parseJsonPayload(res, 'Could not revoke invitation.');
    if (!res.ok) {
      throw new InvitationApiError(body?.message || 'Could not revoke invitation.', {
        errorCode: body?.errorCode,
        statusCode: res.status
      });
    }
    if (!body?.invitation?.id) {
      throw new InvitationApiError('Invitation service returned an incomplete invitation record.', {
        errorCode: 'INVALID_INVITATION_PAYLOAD',
        statusCode: 502
      });
    }
    return body.invitation as Invitation;
  },

  // Get invitations for organization (newest first)
  async getInvitations(orgId: string): Promise<Invitation[]> {
    const path = `organizations/${orgId}/invitations`;
    try {
      const snap = await getDocs(collection(db, 'organizations', orgId, 'invitations'));
      const list = snap.docs
        .map((d) => ({ ...(d.data() as Invitation), id: (d.data() as Invitation)?.id || d.id }))
        .filter((inv): inv is Invitation => Boolean(inv && inv.id));
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Real-time invitations listener for administrators
  listenToInvitations(orgId: string, callback: (invitations: Invitation[]) => void): Unsubscribe {
    const path = `organizations/${orgId}/invitations`;
    return onSnapshot(
      collection(db, 'organizations', orgId, 'invitations'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as Invitation), id: (d.data() as Invitation)?.id || d.id }))
          .filter((inv): inv is Invitation => Boolean(inv && inv.id))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(list);
      },
      (error) => {
        console.warn(`Invitations listener error on ${path}:`, error);
      }
    );
  },

  // Verify invitation code via backend SHA-256 hash lookup
  async verifyInvitationCode(code: string): Promise<VerifiedInvitationSummary> {
    const res = await fetch('/api/invitations/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const body = await parseJsonPayload(res, 'Could not verify invitation code.');
    if (!res.ok || !body?.valid || !body?.invitation) {
      throw new InvitationApiError(
        body?.message || 'Invalid or expired invitation code.',
        {
          errorCode: body?.status || 'INVALID_INVITATION',
          statusCode: res.status
        }
      );
    }
    return body.invitation as VerifiedInvitationSummary;
  },

  // Atomically redeem verified invitation code & create Firestore user profile
  async redeemInvitationCode(
    code: string,
    profile?: { firstName?: string; lastName?: string; employeeId?: string | null; termsAcceptedAt?: string }
  ): Promise<{ user: User; invitationId: string; organizationId: string }> {
    const idToken = await getCallerIdToken();
    const res = await fetch('/api/invitations/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        code,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        employeeId: profile?.employeeId || null,
        termsAcceptedAt: profile?.termsAcceptedAt
      })
    });

    const body = await parseJsonPayload(res, 'Could not redeem invitation code.');
    if (!res.ok || !body?.redeemed || !body?.user?.id) {
      throw new InvitationApiError(
        body?.message || 'Could not redeem invitation code.',
        {
          errorCode: body?.errorCode || 'REDEEM_ERROR',
          statusCode: res.status
        }
      );
    }

    return {
      user: body.user as User,
      invitationId: body.invitationId,
      organizationId: body.organizationId
    };
  },

  // Fetch public authentication & registration policy
  async getAuthPolicy(): Promise<AuthPolicyState> {
    const res = await fetch('/api/auth/policy');
    if (!res.ok) {
      return {
        initialized: false,
        organizationId: null,
        organizationName: null,
        registrationPolicy: 'invitation_only',
        requireEmailVerification: false,
        requireAdminApproval: true
      };
    }
    return (await res.json()) as AuthPolicyState;
  },

  // Update organization registration policy & authentication controls (Admin only)
  async updateAuthPolicy(
    orgId: string,
    updates: {
      registrationPolicy: RegistrationPolicy;
      requireEmailVerification: boolean;
      requireAdminApproval: boolean;
    }
  ): Promise<AuthPolicyState> {
    const idToken = await getCallerIdToken();
    const res = await fetch('/api/auth/policy', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        organizationId: orgId,
        ...updates
      })
    });
    const body = await parseJsonPayload(res, 'Could not update authentication policy.');
    if (!res.ok) {
      throw new Error(body?.message || 'Could not update authentication policy.');
    }
    return {
      initialized: true,
      organizationId: body.organizationId || orgId,
      organizationName: body.organizationName || null,
      registrationPolicy: body.registrationPolicy || updates.registrationPolicy,
      requireEmailVerification: Boolean(body.requireEmailVerification),
      requireAdminApproval: Boolean(body.requireAdminApproval)
    };
  },

  // Provision a new Firebase Email/Password employee account as Administrator (zero email dependencies)
  async adminCreateUserAccount(
    orgId: string,
    payload: {
      firstName: string;
      lastName: string;
      email: string;
      employeeId?: string | null;
      departmentId?: string | null;
      positionId?: string | null;
      roleIds: string[];
      temporaryPassword?: string;
    }
  ): Promise<{ created: boolean; initialPassword?: string; user: User }> {
    const idToken = await getCallerIdToken();
    const res = await fetch('/api/auth/admin-create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        organizationId: orgId,
        ...payload
      })
    });
    const body = await parseJsonPayload(res, 'Could not create user account.');
    if (!res.ok || !body?.user?.id) {
      throw new Error(body?.message || 'Could not create user account.');
    }
    return body as { created: boolean; initialPassword?: string; user: User };
  }
};
