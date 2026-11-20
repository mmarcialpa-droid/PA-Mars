import express from 'express';
import type { Request, Response } from 'express';
import {
  generateId,
  generateInvitationCode,
  hashInvitationCode,
  isValidEmailAddress,
  maskInvitationCode,
  normalizeEmail,
  normalizeInvitationCode
} from './invitationCrypto.ts';
import { buildInvitationEmail } from './emailTemplate.ts';
import {
  sendTransactionalEmail,
  validateProviderConfig,
  type EmailProviderName
} from './emailService.ts';
import {
  loadOrgEmailConfig,
  recordEmailDeliveryOutcome
} from './emailConfigStore.ts';
import {
  fsCommitWrites,
  fsGetDoc,
  fsPatchDoc,
  fsQueryEq,
  verifyFirebaseIdToken,
  type CommitWrite
} from './firestoreRest.ts';
import {
  getBearerToken,
  getGmailAccessToken,
  requireAdminCaller,
  resolveAppOrigin
} from './requestHelpers.ts';

interface SendAttemptRecord {
  attemptAt: string;
  provider: string;
  status: 'sent' | 'failed';
  messageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface InvitationRecord {
  id: string;
  organizationId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  recipientName?: string;
  departmentId?: string | null;
  positionId?: string | null;
  roleIds: string[];
  invitedBy: string;
  tokenHash: string;
  codeMask: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
  lastSentAt?: string | null;
  resendCount?: number;
  deliveryProvider?: string | null;
  providerMessageId?: string | null;
  senderEmail?: string | null;
  deliveryNote?: string | null;
  deliveryError?: string | null;
  sendAttempts?: SendAttemptRecord[];
  redeemedAt?: string | null;
  redeemedBy?: string | null;
  redeemedEmail?: string | null;
}

interface LookupRecord {
  tokenHash: string;
  organizationId: string;
  organizationName: string;
  invitationId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  positionId?: string | null;
  positionTitle?: string | null;
  roleIds: string[];
  roleNames: string[];
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
  redeemedAt?: string | null;
  redeemedBy?: string | null;
}

const RESEND_COOLDOWN_MS = 45_000;
const ADMIN_HOURLY_SEND_LIMIT = 40;
const adminSendTimestamps = new Map<string, number[]>();

function checkAdminRateLimit(uid: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const recent = (adminSendTimestamps.get(uid) || []).filter((ts) => ts > oneHourAgo);
  if (recent.length >= ADMIN_HOURLY_SEND_LIMIT) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  recent.push(now);
  adminSendTimestamps.set(uid, recent);
  return { allowed: true };
}

async function resolveAssignmentLabels(
  organizationId: string,
  idToken: string,
  departmentId: string | null,
  positionId: string | null,
  roleIds: string[]
): Promise<{
  departmentName: string | null;
  positionTitle: string | null;
  roleNames: string[];
}> {
  const [deptDoc, posDoc, roleDocs] = await Promise.all([
    departmentId
      ? fsGetDoc<{ name?: string }>(`organizations/${organizationId}/departments/${departmentId}`, idToken).catch(() => null)
      : Promise.resolve(null),
    positionId
      ? fsGetDoc<{ title?: string }>(`organizations/${organizationId}/positions/${positionId}`, idToken).catch(() => null)
      : Promise.resolve(null),
    Promise.all(
      roleIds.map((rid) =>
        fsGetDoc<{ name?: string }>(`organizations/${organizationId}/roles/${rid}`, idToken).catch(() => null)
      )
    )
  ]);

  return {
    departmentName: deptDoc?.name || null,
    positionTitle: posDoc?.title || null,
    roleNames: roleIds.map((rid, idx) => roleDocs[idx]?.name || rid)
  };
}

export function createInvitationRouter(): express.Router {
  const router = express.Router();

  // Create invitation record with cryptographic code + hash and dispatch via configured active provider
  router.post('/invitations/create-and-send', async (req: Request, res: Response) => {
    try {
      const {
        organizationId,
        email,
        firstName,
        lastName,
        departmentId = null,
        positionId = null,
        roleIds = ['role_member'],
        expirationDays = 7,
        allowDuplicate = false,
        preferredProvider = null
      } = req.body || {};

      if (!organizationId || typeof organizationId !== 'string') {
        return res.status(400).json({ errorCode: 'INVALID_REQUEST', message: 'organizationId is required.' });
      }

      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmailAddress(normalizedEmail)) {
        return res.status(400).json({
          errorCode: 'INVALID_EMAIL',
          message: 'Please provide a valid email address (for example, colleague@gmail.com).'
        });
      }

      const { idToken, fbUser, orgDoc } = await requireAdminCaller(req, organizationId);

      const gmailAccessToken = getGmailAccessToken(req);
      const emailConfig = await loadOrgEmailConfig(organizationId, idToken);
      const effectiveProvider: EmailProviderName =
        (preferredProvider as EmailProviderName | null) || emailConfig.activeProvider;
      const providerDiag = validateProviderConfig(effectiveProvider, { gmailAccessToken });
      const wantsOptionalEmail = req.body?.sendEmail !== false && (providerDiag.configured || emailConfig.allowFallback);

      const rateCheck = checkAdminRateLimit(fbUser.uid);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          errorCode: 'RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSeconds,
          message: `Hourly invitation limit reached. Try again in ${rateCheck.retryAfterSeconds}s.`
        });
      }

      // Check existing users & existing active invitations in parallel
      const [existingUsers, existingInvites] = await Promise.all([
        fsQueryEq<{ id: string; email: string; accountStatus?: string }>(
          'users',
          'organizationId',
          organizationId,
          idToken
        ),
        fsQueryEq<InvitationRecord>(
          `organizations/${organizationId}/invitations`,
          'email',
          normalizedEmail,
          idToken
        )
      ]);

      const alreadyMember = existingUsers.find(
        (u) => normalizeEmail(u.email) === normalizedEmail
      );
      if (alreadyMember) {
        return res.status(409).json({
          errorCode: 'USER_ALREADY_EXISTS',
          message: `${normalizedEmail} already has an account (${alreadyMember.accountStatus || 'active'}) in ${orgDoc.name}.`
        });
      }

      const nowIso = new Date().toISOString();
      const activeExisting = existingInvites.find(
        (inv) =>
          ['pending', 'sending', 'sent', 'failed'].includes(inv.status) &&
          inv.expiresAt > nowIso
      );

      if (activeExisting && !allowDuplicate) {
        return res.status(409).json({
          errorCode: 'DUPLICATE_INVITATION',
          existingInvitationId: activeExisting.id,
          existingStatus: activeExisting.status,
          message: `An active invitation already exists for ${normalizedEmail} (${activeExisting.status}). Use "Resend" to rotate the code and send a fresh email.`
        });
      }

      const cleanRoles =
        Array.isArray(roleIds) && roleIds.length > 0 ? roleIds.map(String) : ['role_member'];
      const days = Math.min(30, Math.max(1, Number(expirationDays) || 7));
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const code = generateInvitationCode();
      const tokenHash = hashInvitationCode(code);
      const codeMask = maskInvitationCode(code);
      const invId = generateId('inv');

      const trimmedFirst = typeof firstName === 'string' ? firstName.trim() : '';
      const trimmedLast = typeof lastName === 'string' ? lastName.trim() : '';
      const recipientName = `${trimmedFirst} ${trimmedLast}`.trim() || normalizedEmail.split('@')[0];

      const labels = await resolveAssignmentLabels(
        organizationId,
        idToken,
        departmentId || null,
        positionId || null,
        cleanRoles
      );

      const invitationDoc: InvitationRecord = {
        id: invId,
        organizationId,
        email: normalizedEmail,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        recipientName,
        departmentId: departmentId || null,
        positionId: positionId || null,
        roleIds: cleanRoles,
        invitedBy: fbUser.uid,
        tokenHash,
        codeMask,
        status: wantsOptionalEmail ? 'sending' : 'pending',
        expiresAt,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastSentAt: wantsOptionalEmail ? null : nowIso,
        resendCount: 0,
        deliveryProvider: null,
        providerMessageId: null,
        senderEmail: null,
        deliveryNote: wantsOptionalEmail
          ? 'Dispatching invitation email...'
          : 'Invitation code generated for in-app sharing (no external email service configured).',
        deliveryError: null,
        sendAttempts: [],
        redeemedAt: null,
        redeemedBy: null,
        redeemedEmail: null
      };

      const lookupDoc: LookupRecord = {
        tokenHash,
        organizationId,
        organizationName: orgDoc.name || 'MARS',
        invitationId: invId,
        email: normalizedEmail,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        departmentId: departmentId || null,
        departmentName: labels.departmentName,
        positionId: positionId || null,
        positionTitle: labels.positionTitle,
        roleIds: cleanRoles,
        roleNames: labels.roleNames,
        status: wantsOptionalEmail ? 'sending' : 'pending',
        expiresAt,
        createdAt: nowIso,
        updatedAt: nowIso,
        redeemedAt: null,
        redeemedBy: null
      };

      // Atomically persist invitation + hash lookup index
      await fsCommitWrites(
        [
          {
            type: 'set',
            docPath: `organizations/${organizationId}/invitations/${invId}`,
            data: invitationDoc as unknown as Record<string, unknown>,
            currentDocument: { exists: false }
          },
          {
            type: 'set',
            docPath: `invitationLookup/${tokenHash}`,
            data: lookupDoc as unknown as Record<string, unknown>,
            currentDocument: { exists: false }
          }
        ],
        idToken
      );

      const appOrigin = resolveAppOrigin(req);
      const registrationUrl = `${appOrigin}/?code=${encodeURIComponent(code)}`;

      if (!wantsOptionalEmail) {
        return res.status(201).json({
          emailDelivered: false,
          invitationCode: code,
          registrationUrl,
          invitation: invitationDoc
        });
      }

      const renderedEmail = buildInvitationEmail({
        recipientName,
        recipientEmail: normalizedEmail,
        organizationName: orgDoc.name || 'MARS',
        invitationCode: code,
        roleLabel: labels.roleNames.join(', ') || 'Team Member',
        departmentName: labels.departmentName,
        positionTitle: labels.positionTitle,
        expiresAtIso: expiresAt,
        registrationUrl
      });

      const idempotencyKey = `inv:${invId}:${tokenHash.slice(0, 16)}`;
      const sendResult = await sendTransactionalEmail({
        toEmail: normalizedEmail,
        toName: recipientName,
        email: renderedEmail,
        gmailAccessToken: gmailAccessToken || null,
        idempotencyKey,
        policy: {
          activeProvider: emailConfig.activeProvider,
          allowFallback: emailConfig.allowFallback,
          fallbackProvider: emailConfig.fallbackProvider
        },
        explicitProvider: (preferredProvider as EmailProviderName | null) || null
      });

      const completedIso = new Date().toISOString();
      const attemptEntry: SendAttemptRecord = sendResult.ok
        ? {
            attemptAt: sendResult.acceptedAt,
            provider: sendResult.provider,
            status: 'sent',
            messageId: sendResult.messageId,
            errorCode: null,
            errorMessage: null
          }
        : {
            attemptAt: completedIso,
            provider: sendResult.provider,
            status: 'failed',
            messageId: null,
            errorCode: sendResult.errorCode,
            errorMessage: sendResult.errorMessage
          };

      const nextStatus = sendResult.ok ? 'sent' : 'failed';
      const updatedFields: Partial<InvitationRecord> = sendResult.ok
        ? {
            status: 'sent',
            updatedAt: completedIso,
            lastSentAt: sendResult.acceptedAt,
            deliveryProvider: sendResult.provider,
            providerMessageId: sendResult.messageId,
            senderEmail: sendResult.senderEmail,
            deliveryNote: sendResult.deliveryNote,
            deliveryError: null,
            sendAttempts: [attemptEntry]
          }
        : {
            status: 'failed',
            updatedAt: completedIso,
            deliveryProvider: sendResult.provider,
            providerMessageId: null,
            deliveryNote: 'Provider did not accept message for delivery.',
            deliveryError: sendResult.errorMessage,
            sendAttempts: [attemptEntry]
          };

      await Promise.all([
        fsCommitWrites(
          [
            {
              type: 'update',
              docPath: `organizations/${organizationId}/invitations/${invId}`,
              data: updatedFields as Record<string, unknown>
            },
            {
              type: 'update',
              docPath: `invitationLookup/${tokenHash}`,
              data: { status: nextStatus, updatedAt: completedIso }
            }
          ],
          idToken
        ),
        recordEmailDeliveryOutcome({
          orgId: organizationId,
          idToken,
          actorUid: fbUser.uid,
          recipientEmail: normalizedEmail,
          subject: renderedEmail.subject,
          category: 'invitation',
          relatedInvitationId: invId,
          idempotencyKey,
          result: sendResult,
          currentConfig: emailConfig
        })
      ]);

      const finalInvitation: InvitationRecord = { ...invitationDoc, ...updatedFields };

      if (!sendResult.ok) {
        return res.status(201).json({
          emailDelivered: false,
          invitationCode: code,
          registrationUrl,
          errorCode: sendResult.errorCode,
          message: sendResult.errorMessage,
          invitation: finalInvitation
        });
      }

      return res.status(201).json({
        emailDelivered: true,
        invitationCode: code,
        registrationUrl,
        deliveryResult: {
          provider: sendResult.provider,
          messageId: sendResult.messageId,
          senderEmail: sendResult.senderEmail,
          acceptedAt: sendResult.acceptedAt,
          deliveryNote: sendResult.deliveryNote
        },
        invitation: finalInvitation
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      console.error('[Invitations] create-and-send error:', err?.message || err);
      return res.status(status).json({
        errorCode: err?.errorCode || 'INVITATION_ERROR',
        message: err?.message || 'Failed to create and send invitation.'
      });
    }
  });

  // Resend invitation: rotates cryptographic code + hash cleanly, enforces cooldown & rate limit, sends email
  router.post('/invitations/resend', async (req: Request, res: Response) => {
    try {
      const { organizationId, invitationId, preferredProvider = null } = req.body || {};
      if (!organizationId || !invitationId) {
        return res.status(400).json({ errorCode: 'INVALID_REQUEST', message: 'organizationId and invitationId are required.' });
      }

      const { idToken, fbUser, orgDoc } = await requireAdminCaller(req, organizationId);

      const invPath = `organizations/${organizationId}/invitations/${invitationId}`;
      const existing = await fsGetDoc<InvitationRecord>(invPath, idToken);
      if (!existing) {
        return res.status(404).json({ errorCode: 'NOT_FOUND', message: 'Invitation record not found.' });
      }

      if (existing.status === 'accepted') {
        return res.status(409).json({
          errorCode: 'ALREADY_ACCEPTED',
          message: 'This invitation has already been accepted and cannot be resent.'
        });
      }
      if (existing.status === 'revoked') {
        return res.status(409).json({
          errorCode: 'REVOKED',
          message: 'This invitation has been revoked. Create a new invitation instead.'
        });
      }

      const gmailAccessToken = getGmailAccessToken(req);
      const emailConfig = await loadOrgEmailConfig(organizationId, idToken);
      const effectiveProvider: EmailProviderName =
        (preferredProvider as EmailProviderName | null) || emailConfig.activeProvider;
      const providerDiag = validateProviderConfig(effectiveProvider, { gmailAccessToken });
      const wantsOptionalEmail = req.body?.sendEmail !== false && (providerDiag.configured || emailConfig.allowFallback);

      // Per-invitation resend cooldown (allow immediate retry when previous status is failed or in-app pending)
      if (wantsOptionalEmail && existing.lastSentAt && existing.status !== 'failed') {
        const elapsed = Date.now() - new Date(existing.lastSentAt).getTime();
        if (elapsed >= 0 && elapsed < RESEND_COOLDOWN_MS) {
          const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return res.status(429).json({
            errorCode: 'RESEND_COOLDOWN',
            retryAfterSeconds: waitSec,
            message: `Please wait ${waitSec}s before resending this invitation email.`
          });
        }
      }

      const rateCheck = checkAdminRateLimit(fbUser.uid);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          errorCode: 'RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSeconds,
          message: `Hourly invitation send limit reached. Try again in ${rateCheck.retryAfterSeconds}s.`
        });
      }

      // Rotate cryptographic code + hash and invalidate previous hash lookup
      const code = generateInvitationCode();
      const newTokenHash = hashInvitationCode(code);
      const newCodeMask = maskInvitationCode(code);
      const nowIso = new Date().toISOString();
      const refreshedExpiresAt =
        existing.expiresAt > nowIso
          ? existing.expiresAt
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const labels = await resolveAssignmentLabels(
        organizationId,
        idToken,
        existing.departmentId || null,
        existing.positionId || null,
        existing.roleIds || ['role_member']
      );

      const recipientName =
        existing.recipientName ||
        `${existing.firstName || ''} ${existing.lastName || ''}`.trim() ||
        existing.email.split('@')[0];

      const nextResendBaseCount = (existing.resendCount || 0) + (wantsOptionalEmail ? 0 : 1);
      const preSendWrites: CommitWrite[] = [
        {
          type: 'update',
          docPath: invPath,
          data: {
            tokenHash: newTokenHash,
            codeMask: newCodeMask,
            status: wantsOptionalEmail ? 'sending' : 'pending',
            expiresAt: refreshedExpiresAt,
            updatedAt: nowIso,
            ...(wantsOptionalEmail
              ? {}
              : {
                  lastSentAt: nowIso,
                  resendCount: nextResendBaseCount,
                  deliveryProvider: null,
                  deliveryError: null
                }),
            deliveryNote: wantsOptionalEmail
              ? 'Re-sending invitation with rotated security code...'
              : 'Fresh invitation code generated for in-app sharing.'
          }
        },
        {
          type: 'set',
          docPath: `invitationLookup/${newTokenHash}`,
          data: {
            tokenHash: newTokenHash,
            organizationId,
            organizationName: orgDoc.name || 'MARS',
            invitationId,
            email: existing.email,
            firstName: existing.firstName || '',
            lastName: existing.lastName || '',
            departmentId: existing.departmentId || null,
            departmentName: labels.departmentName,
            positionId: existing.positionId || null,
            positionTitle: labels.positionTitle,
            roleIds: existing.roleIds || ['role_member'],
            roleNames: labels.roleNames,
            status: wantsOptionalEmail ? 'sending' : 'pending',
            expiresAt: refreshedExpiresAt,
            createdAt: existing.createdAt,
            updatedAt: nowIso,
            redeemedAt: null,
            redeemedBy: null
          }
        }
      ];

      if (
        existing.tokenHash &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(existing.tokenHash) &&
        existing.tokenHash !== newTokenHash
      ) {
        preSendWrites.push({
          type: 'delete',
          docPath: `invitationLookup/${existing.tokenHash}`
        });
      }

      await fsCommitWrites(preSendWrites, idToken);

      const appOrigin = resolveAppOrigin(req);
      const registrationUrl = `${appOrigin}/?code=${encodeURIComponent(code)}`;

      if (!wantsOptionalEmail) {
        const updatedInApp: InvitationRecord = {
          ...existing,
          tokenHash: newTokenHash,
          codeMask: newCodeMask,
          status: 'pending',
          expiresAt: refreshedExpiresAt,
          updatedAt: nowIso,
          lastSentAt: nowIso,
          resendCount: nextResendBaseCount,
          deliveryProvider: null,
          deliveryError: null,
          deliveryNote: 'Fresh invitation code generated for in-app sharing.'
        };
        return res.json({
          emailDelivered: false,
          invitationCode: code,
          registrationUrl,
          invitation: updatedInApp
        });
      }

      const renderedEmail = buildInvitationEmail({
        recipientName,
        recipientEmail: existing.email,
        organizationName: orgDoc.name || 'MARS',
        invitationCode: code,
        roleLabel: labels.roleNames.join(', ') || 'Team Member',
        departmentName: labels.departmentName,
        positionTitle: labels.positionTitle,
        expiresAtIso: refreshedExpiresAt,
        registrationUrl
      });

      const resendIdempotencyKey = `resend:${invitationId}:${newTokenHash.slice(0, 16)}`;
      const sendResult = await sendTransactionalEmail({
        toEmail: existing.email,
        toName: recipientName,
        email: renderedEmail,
        gmailAccessToken: gmailAccessToken || null,
        idempotencyKey: resendIdempotencyKey,
        policy: {
          activeProvider: emailConfig.activeProvider,
          allowFallback: emailConfig.allowFallback,
          fallbackProvider: emailConfig.fallbackProvider
        },
        explicitProvider: (preferredProvider as EmailProviderName | null) || null
      });

      const completedIso = new Date().toISOString();
      const attemptEntry: SendAttemptRecord = sendResult.ok
        ? {
            attemptAt: sendResult.acceptedAt,
            provider: sendResult.provider,
            status: 'sent',
            messageId: sendResult.messageId,
            errorCode: null,
            errorMessage: null
          }
        : {
            attemptAt: completedIso,
            provider: sendResult.provider,
            status: 'failed',
            messageId: null,
            errorCode: sendResult.errorCode,
            errorMessage: sendResult.errorMessage
          };

      const prevAttempts = Array.isArray(existing.sendAttempts) ? existing.sendAttempts : [];
      const nextAttempts = [attemptEntry, ...prevAttempts].slice(0, 20);
      const nextStatus = sendResult.ok ? 'sent' : 'failed';
      const nextResendCount = (existing.resendCount || 0) + (sendResult.ok ? 1 : 0);

      const finalUpdates: Partial<InvitationRecord> = sendResult.ok
        ? {
            status: 'sent',
            updatedAt: completedIso,
            lastSentAt: sendResult.acceptedAt,
            resendCount: nextResendCount,
            deliveryProvider: sendResult.provider,
            providerMessageId: sendResult.messageId,
            senderEmail: sendResult.senderEmail,
            deliveryNote: sendResult.deliveryNote,
            deliveryError: null,
            sendAttempts: nextAttempts
          }
        : {
            status: 'failed',
            updatedAt: completedIso,
            deliveryProvider: sendResult.provider,
            providerMessageId: null,
            deliveryNote: 'Resend failed — provider did not accept message.',
            deliveryError: sendResult.errorMessage,
            sendAttempts: nextAttempts
          };

      await Promise.all([
        fsCommitWrites(
          [
            {
              type: 'update',
              docPath: invPath,
              data: finalUpdates as Record<string, unknown>
            },
            {
              type: 'update',
              docPath: `invitationLookup/${newTokenHash}`,
              data: { status: nextStatus, updatedAt: completedIso }
            }
          ],
          idToken
        ),
        recordEmailDeliveryOutcome({
          orgId: organizationId,
          idToken,
          actorUid: fbUser.uid,
          recipientEmail: existing.email,
          subject: renderedEmail.subject,
          category: 'invitation',
          relatedInvitationId: invitationId,
          idempotencyKey: resendIdempotencyKey,
          result: sendResult,
          currentConfig: emailConfig
        })
      ]);

      const updatedInvitation: InvitationRecord = {
        ...existing,
        tokenHash: newTokenHash,
        codeMask: newCodeMask,
        expiresAt: refreshedExpiresAt,
        ...finalUpdates
      };

      if (!sendResult.ok) {
        return res.json({
          emailDelivered: false,
          invitationCode: code,
          registrationUrl,
          errorCode: sendResult.errorCode,
          message: sendResult.errorMessage,
          invitation: updatedInvitation
        });
      }

      return res.json({
        emailDelivered: true,
        invitationCode: code,
        registrationUrl,
        deliveryResult: {
          provider: sendResult.provider,
          messageId: sendResult.messageId,
          senderEmail: sendResult.senderEmail,
          acceptedAt: sendResult.acceptedAt,
          deliveryNote: sendResult.deliveryNote
        },
        invitation: updatedInvitation
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      console.error('[Invitations] resend error:', err?.message || err);
      return res.status(status).json({
        errorCode: err?.errorCode || 'RESEND_ERROR',
        message: err?.message || 'Failed to resend invitation.'
      });
    }
  });

  // Revoke invitation and invalidate its lookup hash
  router.post('/invitations/revoke', async (req: Request, res: Response) => {
    try {
      const { organizationId, invitationId } = req.body || {};
      if (!organizationId || !invitationId) {
        return res.status(400).json({ errorCode: 'INVALID_REQUEST', message: 'organizationId and invitationId are required.' });
      }

      const { idToken } = await requireAdminCaller(req, organizationId);
      const invPath = `organizations/${organizationId}/invitations/${invitationId}`;
      const existing = await fsGetDoc<InvitationRecord>(invPath, idToken);
      if (!existing) {
        return res.status(404).json({ errorCode: 'NOT_FOUND', message: 'Invitation not found.' });
      }
      if (existing.status === 'accepted') {
        return res.status(409).json({ errorCode: 'ALREADY_ACCEPTED', message: 'Accepted invitations cannot be revoked.' });
      }

      const nowIso = new Date().toISOString();
      const writes: CommitWrite[] = [
        {
          type: 'update',
          docPath: invPath,
          data: {
            status: 'revoked',
            updatedAt: nowIso,
            deliveryNote: 'Revoked by administrator.'
          }
        }
      ];

      if (existing.tokenHash) {
        writes.push({
          type: 'update',
          docPath: `invitationLookup/${existing.tokenHash}`,
          data: { status: 'revoked', updatedAt: nowIso }
        });
      }

      await fsCommitWrites(writes, idToken);
      return res.json({
        invitation: { ...existing, status: 'revoked', updatedAt: nowIso }
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      return res.status(status).json({
        errorCode: err?.errorCode || 'REVOKE_ERROR',
        message: err?.message || 'Failed to revoke invitation.'
      });
    }
  });

  // Public pre-registration verification of invitation code using SHA-256 hash lookup
  router.post('/invitations/verify', async (req: Request, res: Response) => {
    try {
      const rawCode = String(req.body?.code || req.body?.token || '').trim();
      const normalized = normalizeInvitationCode(rawCode);
      if (!normalized || normalized.length < 8) {
        return res.status(400).json({
          valid: false,
          status: 'invalid',
          message: 'Please enter a valid invitation code (for example, MARS-XXXX-XXXX-XXXX).'
        });
      }

      const tokenHash = hashInvitationCode(normalized);
      const lookup = await fsGetDoc<LookupRecord>(`invitationLookup/${tokenHash}`, null);

      if (!lookup) {
        return res.status(404).json({
          valid: false,
          status: 'not_found',
          message: 'Invitation code not found. It may have been replaced by a newer resend or mistyped.'
        });
      }

      const nowIso = new Date().toISOString();
      if (lookup.status === 'accepted') {
        return res.status(409).json({
          valid: false,
          status: 'accepted',
          message: 'This invitation has already been redeemed. Please sign in with your registered account.'
        });
      }
      if (lookup.status === 'revoked') {
        return res.status(410).json({
          valid: false,
          status: 'revoked',
          message: 'This invitation has been revoked by an administrator.'
        });
      }
      if (lookup.status === 'expired' || lookup.expiresAt < nowIso) {
        return res.status(410).json({
          valid: false,
          status: 'expired',
          message: 'This invitation code has expired. Please ask your administrator to resend your invitation.'
        });
      }

      return res.json({
        valid: true,
        invitation: {
          id: lookup.invitationId,
          organizationId: lookup.organizationId,
          organizationName: lookup.organizationName,
          email: lookup.email,
          firstName: lookup.firstName || '',
          lastName: lookup.lastName || '',
          departmentId: lookup.departmentId || null,
          departmentName: lookup.departmentName || null,
          positionId: lookup.positionId || null,
          positionTitle: lookup.positionTitle || null,
          roleIds: lookup.roleIds,
          roleNames: lookup.roleNames || [],
          status: lookup.status,
          expiresAt: lookup.expiresAt
        }
      });
    } catch (err: any) {
      console.error('[Invitations] verify error:', err?.message || err);
      return res.status(500).json({
        valid: false,
        status: 'error',
        message: 'Could not verify invitation code right now. Please try again.'
      });
    }
  });

  // Atomic redemption after Firebase Auth sign-in/registration
  router.post('/invitations/redeem', async (req: Request, res: Response) => {
    try {
      const idToken = getBearerToken(req);
      if (!idToken) {
        return res.status(401).json({ errorCode: 'UNAUTHORIZED', message: 'Authentication token required to redeem invitation.' });
      }

      const fbUser = await verifyFirebaseIdToken(idToken);
      const rawCode = String(req.body?.code || req.body?.token || '').trim();
      const tokenHash = hashInvitationCode(rawCode);

      if (!rawCode) {
        return res.status(400).json({ errorCode: 'INVALID_REQUEST', message: 'Invitation code is required.' });
      }

      const lookup = await fsGetDoc<LookupRecord>(`invitationLookup/${tokenHash}`, idToken);
      if (!lookup) {
        return res.status(404).json({
          errorCode: 'NOT_FOUND',
          message: 'Invitation code not found or superseded by a newer resend.'
        });
      }

      const nowIso = new Date().toISOString();
      if (lookup.status === 'accepted') {
        return res.status(409).json({ errorCode: 'ALREADY_ACCEPTED', message: 'This invitation has already been redeemed.' });
      }
      if (lookup.status === 'revoked') {
        return res.status(410).json({ errorCode: 'REVOKED', message: 'This invitation was revoked by an administrator.' });
      }
      if (lookup.status === 'expired' || lookup.expiresAt < nowIso) {
        return res.status(410).json({ errorCode: 'EXPIRED', message: 'This invitation has expired.' });
      }

      const authEmail = normalizeEmail(fbUser.email);
      const invitedEmail = normalizeEmail(lookup.email);
      if (!authEmail || authEmail !== invitedEmail) {
        return res.status(403).json({
          errorCode: 'EMAIL_MISMATCH',
          message: `You authenticated as ${fbUser.email}, but this invitation was issued specifically for ${lookup.email}. Please sign in with ${lookup.email}.`
        });
      }

      const firstNameInput = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
      const lastNameInput = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
      const nameParts = (fbUser.displayName || '').trim().split(/\s+/).filter(Boolean);

      const firstName = firstNameInput || lookup.firstName || nameParts[0] || authEmail.split('@')[0];
      const lastName = lastNameInput || lookup.lastName || nameParts.slice(1).join(' ') || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const roleIds = Array.isArray(lookup.roleIds) && lookup.roleIds.length > 0 ? lookup.roleIds : ['role_member'];

      const existingUser = await fsGetDoc<Record<string, unknown>>(`users/${fbUser.uid}`, idToken);

      const invDocPath = `organizations/${lookup.organizationId}/invitations/${lookup.invitationId}`;
      const lookupDocPath = `invitationLookup/${tokenHash}`;

      const avatar =
        fbUser.photoUrl ||
        (typeof existingUser?.avatar === 'string' && existingUser.avatar) ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0f172a&color=fff`;

      const employeeIdInput =
        typeof req.body?.employeeId === 'string' && req.body.employeeId.trim()
          ? req.body.employeeId.trim()
          : null;

      const termsAcceptedAt =
        typeof req.body?.termsAcceptedAt === 'string' && req.body.termsAcceptedAt.trim()
          ? req.body.termsAcceptedAt.trim()
          : nowIso;

      const userProfile: Record<string, unknown> = {
        id: fbUser.uid,
        organizationId: lookup.organizationId,
        firstName,
        lastName,
        name: fullName,
        email: authEmail,
        ...(employeeIdInput ? { employeeId: employeeIdInput } : {}),
        avatar,
        departmentId: lookup.departmentId || null,
        department: lookup.departmentName || undefined,
        positionId: lookup.positionId || null,
        title: lookup.positionTitle || undefined,
        managerId: null,
        roleIds,
        primaryRoleId: roleIds[0],
        accountStatus: 'active',
        emailVerified: Boolean(fbUser.emailVerified),
        invitedTokenHash: tokenHash,
        termsAcceptedAt,
        dateJoined: nowIso.split('T')[0],
        createdAt: (existingUser?.createdAt as string) || nowIso,
        updatedAt: nowIso
      };

      const commitWrites: CommitWrite[] = [
        {
          type: 'update',
          docPath: invDocPath,
          data: {
            status: 'accepted',
            redeemedAt: nowIso,
            redeemedBy: fbUser.uid,
            redeemedEmail: authEmail,
            updatedAt: nowIso
          }
        },
        {
          type: 'update',
          docPath: lookupDocPath,
          data: {
            status: 'accepted',
            redeemedAt: nowIso,
            redeemedBy: fbUser.uid,
            updatedAt: nowIso
          },
          ...(lookup._updateTime ? { currentDocument: { updateTime: lookup._updateTime } } : {})
        }
      ];

      if (!existingUser) {
        commitWrites.push({
          type: 'set',
          docPath: `users/${fbUser.uid}`,
          data: userProfile,
          currentDocument: { exists: false }
        });
      }

      await fsCommitWrites(commitWrites, idToken);

      return res.json({
        redeemed: true,
        user: userProfile,
        invitationId: lookup.invitationId,
        organizationId: lookup.organizationId
      });
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to redeem invitation.');
      const isConflict = msg.includes('FAILED_PRECONDITION') || msg.includes('ALREADY_EXISTS');
      console.error('[Invitations] redeem error:', msg);
      return res.status(isConflict ? 409 : 500).json({
        errorCode: isConflict ? 'ALREADY_REDEEMED' : 'REDEEM_ERROR',
        message: isConflict
          ? 'This invitation was already redeemed in another session.'
          : msg
      });
    }
  });

  // Backwards-compatible cleanup endpoint if needed to update a failed/draft doc without sending
  router.post('/invitations/mark-expired', async (req: Request, res: Response) => {
    try {
      const { organizationId, invitationId } = req.body || {};
      if (!organizationId || !invitationId) {
        return res.status(400).json({ errorCode: 'INVALID_REQUEST', message: 'organizationId and invitationId are required.' });
      }
      const { idToken } = await requireAdminCaller(req, organizationId);
      await fsPatchDoc(
        `organizations/${organizationId}/invitations/${invitationId}`,
        { status: 'expired', updatedAt: new Date().toISOString() },
        idToken
      );
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || 'Failed to update status.' });
    }
  });

  return router;
}
