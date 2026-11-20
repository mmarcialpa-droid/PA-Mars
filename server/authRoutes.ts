import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import {
  fsCommitWrites,
  fsGetDoc,
  fsPatchDoc,
  fsQueryEq,
  fsSetDoc,
  getFirebaseWebApiKey,
  verifyFirebaseIdToken
} from './firestoreRest.ts';
import { getBearerToken, requireAdminCaller } from './requestHelpers.ts';

type RegistrationPolicy = 'invitation_only' | 'admin_created' | 'public_registration';

const VALID_POLICIES = new Set<RegistrationPolicy>([
  'invitation_only',
  'admin_created',
  'public_registration'
]);

function normalizePolicy(raw: unknown): RegistrationPolicy {
  if (typeof raw === 'string' && VALID_POLICIES.has(raw as RegistrationPolicy)) {
    return raw as RegistrationPolicy;
  }
  return 'invitation_only';
}

function generateSecureTempPassword(): string {
  // Meets complexity and >= 8 chars requirements cleanly
  return `Mars!${crypto.randomBytes(9).toString('base64url')}9a`;
}

// Lightweight sliding-window throttle store (keyed by IP + action + identifier)
const authThrottleStore = new Map<string, number[]>();

function evaluateThrottle(
  key: string,
  limit: number,
  windowMs: number,
  recordAttempt = true
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (authThrottleStore.get(key) || []).filter((ts) => ts > cutoff);

  if (recent.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    authThrottleStore.set(key, recent);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  if (recordAttempt) {
    recent.push(now);
  }
  authThrottleStore.set(key, recent);
  return {
    allowed: true,
    remaining: Math.max(0, limit - recent.length),
    retryAfterSeconds: 0
  };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

export function createAuthRouter(): express.Router {
  const router = express.Router();

  // Publicly accessible registration policy (zero PII)
  router.get('/auth/policy', async (_req: Request, res: Response) => {
    try {
      const config = await fsGetDoc<Record<string, unknown>>('system/config');
      const policy = normalizePolicy(config?.registrationPolicy);
      return res.json({
        initialized: Boolean(config?.initialized),
        organizationId: (config?.organizationId as string) || null,
        organizationName: (config?.organizationName as string) || null,
        registrationPolicy: policy,
        requireEmailVerification:
          config?.requireEmailVerification === undefined
            ? false
            : Boolean(config.requireEmailVerification),
        requireAdminApproval:
          config?.requireAdminApproval === undefined
            ? true
            : Boolean(config.requireAdminApproval)
      });
    } catch (err: any) {
      return res.json({
        initialized: false,
        organizationId: null,
        organizationName: null,
        registrationPolicy: 'invitation_only' as RegistrationPolicy,
        requireEmailVerification: false,
        requireAdminApproval: true,
        warning: err?.message || 'Fallback policy used'
      });
    }
  });

  // Update registration policy & authentication controls (Admin / Super Admin only)
  router.put('/auth/policy', async (req: Request, res: Response) => {
    try {
      if (!getBearerToken(req)) {
        return res.status(401).json({ message: 'Authentication token is required.' });
      }

      const {
        organizationId,
        registrationPolicy,
        requireEmailVerification = false,
        requireAdminApproval = true
      } = req.body || {};

      if (!organizationId || typeof organizationId !== 'string') {
        return res.status(400).json({ message: 'organizationId is required.' });
      }
      if (!VALID_POLICIES.has(registrationPolicy)) {
        return res.status(400).json({
          message: 'registrationPolicy must be invitation_only, admin_created, or public_registration.'
        });
      }

      const { idToken, orgDoc } = await requireAdminCaller(req, organizationId);
      const nowIso = new Date().toISOString();
      const policy = normalizePolicy(registrationPolicy);
      const requireVerifyBool = Boolean(requireEmailVerification);
      const requireApprovalBool = Boolean(requireAdminApproval);

      await fsCommitWrites(
        [
          {
            type: 'update',
            docPath: `organizations/${organizationId}`,
            data: {
              registrationPolicy: policy,
              allowPublicRegistration: policy === 'public_registration',
              requireEmailVerification: requireVerifyBool,
              requireAdminApproval: requireApprovalBool,
              updatedAt: nowIso
            }
          },
          {
            type: 'update',
            docPath: 'system/config',
            data: {
              organizationId,
              organizationName: orgDoc.name,
              registrationPolicy: policy,
              requireEmailVerification: requireVerifyBool,
              requireAdminApproval: requireApprovalBool,
              updatedAt: nowIso
            }
          }
        ],
        idToken
      );

      return res.json({
        updated: true,
        organizationId,
        organizationName: orgDoc.name,
        registrationPolicy: policy,
        requireEmailVerification: requireVerifyBool,
        requireAdminApproval: requireApprovalBool
      });
    } catch (err: any) {
      const status = err?.statusCode || 500;
      return res.status(status).json({
        message: err?.message || 'Failed to update authentication policy.'
      });
    }
  });

  // Rate-limit guard for login failures & administrator-assisted recovery requests
  router.post('/auth/throttle-check', (req: Request, res: Response) => {
    const action = req.body?.action === 'recovery' ? 'recovery' : 'login';
    const identifier = String(req.body?.email || '').trim().toLowerCase() || 'anon';
    const recordAttempt = req.body?.recordAttempt !== false;
    const clear = Boolean(req.body?.clear);
    const ip = getClientIp(req);
    const key = `${action}:${ip}:${identifier}`;

    if (clear) {
      authThrottleStore.delete(key);
      return res.json({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
    }

    const limit = action === 'recovery' ? 4 : 6;
    const windowMs = action === 'recovery' ? 15 * 60 * 1000 : 5 * 60 * 1000;
    const status = evaluateThrottle(key, limit, windowMs, recordAttempt);

    if (!status.allowed) {
      return res.status(429).json({
        allowed: false,
        retryAfterSeconds: status.retryAfterSeconds,
        message: `Too many ${action === 'recovery' ? 'password recovery' : 'sign-in'} attempts. Please wait ${status.retryAfterSeconds}s and try again.`
      });
    }

    return res.json(status);
  });

  // Backwards-compatible account activation endpoint (no mandatory email verification gate)
  router.post('/auth/activate-verified', async (req: Request, res: Response) => {
    try {
      const idToken = getBearerToken(req);
      if (!idToken) {
        return res.status(401).json({
          errorCode: 'UNAUTHORIZED',
          message: 'Authentication token is required.'
        });
      }

      const fbUser = await verifyFirebaseIdToken(idToken);
      const [existingUser, sysConfig] = await Promise.all([
        fsGetDoc<Record<string, unknown>>(`users/${fbUser.uid}`, idToken),
        fsGetDoc<Record<string, unknown>>('system/config')
      ]);

      if (!existingUser) {
        return res.status(404).json({
          errorCode: 'PROFILE_NOT_FOUND',
          message: 'User profile not found. Please complete registration or contact an administrator.'
        });
      }

      if (existingUser.accountStatus === 'suspended') {
        return res.status(403).json({
          errorCode: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended by an administrator.'
        });
      }
      if (existingUser.accountStatus === 'rejected') {
        return res.status(403).json({
          errorCode: 'ACCOUNT_REJECTED',
          message: 'Your registration request was declined by an administrator.'
        });
      }
      if (existingUser.accountStatus === 'archived') {
        return res.status(403).json({
          errorCode: 'ACCOUNT_ARCHIVED',
          message: 'This account has been archived and can no longer access the workspace.'
        });
      }

      const nowIso = new Date().toISOString();
      const roleIds = Array.isArray(existingUser.roleIds) ? (existingUser.roleIds as string[]) : [];
      const isAdminAccount = roleIds.some((r) =>
        ['role_super_admin', 'role_admin', 'super_admin'].includes(r)
      );
      const hasInvitationClaim =
        typeof existingUser.invitedTokenHash === 'string' && existingUser.invitedTokenHash.length > 0;
      const requireApproval =
        sysConfig?.requireAdminApproval === undefined
          ? true
          : Boolean(sysConfig.requireAdminApproval);

      let nextStatus = String(existingUser.accountStatus || 'pending_approval');
      if (nextStatus === 'pending_verification' || nextStatus === 'invited') {
        if (isAdminAccount || hasInvitationClaim || !requireApproval) {
          nextStatus = 'active';
        } else {
          nextStatus = 'pending_approval';
        }
      }

      await fsPatchDoc(
        `users/${fbUser.uid}`,
        {
          emailVerified: Boolean(fbUser.emailVerified),
          accountStatus: nextStatus,
          updatedAt: nowIso
        },
        idToken
      );

      return res.json({
        activated: nextStatus === 'active',
        emailVerified: Boolean(fbUser.emailVerified),
        accountStatus: nextStatus,
        user: {
          ...existingUser,
          emailVerified: Boolean(fbUser.emailVerified),
          accountStatus: nextStatus,
          updatedAt: nowIso
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        errorCode: 'ACTIVATION_ERROR',
        message: err?.message || 'Could not refresh account status.'
      });
    }
  });

  // Administrator-provisioned user account (Firebase Auth Email/Password + Firestore profile, NO emails sent)
  router.post('/auth/admin-create-user', async (req: Request, res: Response) => {
    try {
      if (!getBearerToken(req)) {
        return res.status(401).json({ message: 'Authentication token is required.' });
      }

      const {
        organizationId,
        firstName,
        lastName,
        email,
        employeeId = null,
        departmentId = null,
        positionId = null,
        managerId = null,
        roleIds = ['role_member'],
        temporaryPassword
      } = req.body || {};

      if (!organizationId || !firstName?.trim() || !email?.trim()) {
        return res.status(400).json({
          message: 'organizationId, firstName, and email are required.'
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
      }

      const { idToken, userDoc: callerDoc } = await requireAdminCaller(req, organizationId);
      const callerRoles = Array.isArray(callerDoc?.roleIds) ? callerDoc.roleIds : [];
      const callerIsSuperAdmin = callerRoles.includes('role_super_admin');

      const requestedRoles = Array.isArray(roleIds) && roleIds.length > 0 ? roleIds.map(String) : ['role_member'];
      if (requestedRoles.includes('role_super_admin') && !callerIsSuperAdmin) {
        return res.status(403).json({
          message: 'Only a Super Administrator can assign the Super Administrator role.'
        });
      }

      // Check existing Firestore users by email
      const existingUsers = await fsQueryEq<Record<string, unknown>>('users', 'email', normalizedEmail, idToken);
      if (existingUsers.length > 0) {
        return res.status(409).json({
          message: `A user profile with email ${normalizedEmail} already exists in MARS.`
        });
      }

      const apiKey = getFirebaseWebApiKey();
      const useCustomPassword = typeof temporaryPassword === 'string' && temporaryPassword.trim().length > 0;
      if (useCustomPassword && temporaryPassword.trim().length < 8) {
        return res.status(400).json({
          message: 'Initial password must be at least 8 characters long.'
        });
      }

      const initialPassword = useCustomPassword ? temporaryPassword.trim() : generateSecureTempPassword();
      const trimmedFirst = String(firstName).trim();
      const trimmedLast = String(lastName || '').trim();
      const fullName = `${trimmedFirst} ${trimmedLast}`.trim();
      const cleanEmployeeId = typeof employeeId === 'string' && employeeId.trim() ? employeeId.trim() : null;

      // Provision Firebase Auth Email/Password user via Identity Toolkit REST API
      // (Does not alter the administrator's current browser Auth session and sends NO emails)
      const signUpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            password: initialPassword,
            displayName: fullName,
            returnSecureToken: true
          })
        }
      );
      const signUpData = (await signUpRes.json().catch(() => ({}))) as {
        localId?: string;
        error?: { message?: string };
      };

      if (!signUpRes.ok || !signUpData.localId) {
        const fbCode = signUpData?.error?.message || '';
        if (fbCode.includes('EMAIL_EXISTS')) {
          return res.status(409).json({
            message: `An authentication account for ${normalizedEmail} already exists in Firebase Auth.`
          });
        }
        if (fbCode.includes('OPERATION_NOT_ALLOWED')) {
          return res.status(400).json({
            message:
              'Email/Password sign-in is not yet enabled in Firebase Authentication Console. Enable Email/Password under Authentication -> Sign-in method first.'
          });
        }
        return res.status(400).json({
          message: fbCode || 'Could not create Firebase Authentication account.'
        });
      }

      const newUid = signUpData.localId;
      const nowIso = new Date().toISOString();

      // Create Firestore profile document as Administrator (never store passwords in Firestore)
      const newUserProfile: Record<string, unknown> = {
        id: newUid,
        organizationId,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        name: fullName,
        email: normalizedEmail,
        ...(cleanEmployeeId ? { employeeId: cleanEmployeeId } : {}),
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0f172a&color=fff`,
        departmentId: departmentId || null,
        positionId: positionId || null,
        managerId: managerId || null,
        roleIds: requestedRoles,
        primaryRoleId: requestedRoles[0],
        accountStatus: 'active',
        emailVerified: false,
        dateJoined: nowIso.split('T')[0],
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await fsSetDoc(`users/${newUid}`, newUserProfile, idToken);

      return res.status(201).json({
        created: true,
        emailActionDispatched: 'none',
        initialPassword,
        user: newUserProfile
      });
    } catch (err: any) {
      const status = err?.statusCode || 500;
      return res.status(status).json({
        message: err?.message || 'Failed to create employee account.'
      });
    }
  });

  return router;
}
