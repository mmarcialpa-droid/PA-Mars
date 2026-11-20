import express from 'express';
import type { Request, Response } from 'express';
import { isValidEmailAddress, normalizeEmail } from './invitationCrypto.ts';
import {
  buildEmailStatusSnapshot,
  inspectGmailProfile,
  isValidProviderName,
  sendTransactionalEmail,
  validateProviderConfig,
  type EmailProviderName
} from './emailService.ts';
import {
  listOrgEmailLogs,
  loadOrgEmailConfig,
  recordEmailDeliveryOutcome,
  saveOrgEmailConfig,
  type StoredEmailDeliveryLog
} from './emailConfigStore.ts';
import { fsGetDoc } from './firestoreRest.ts';
import { getGmailAccessToken, requireAdminCaller } from './requestHelpers.ts';

function buildTestEmailPayload(params: {
  organizationName: string;
  recipientEmail: string;
  providerLabel: string;
  triggeredByEmail: string;
  note?: string;
}) {
  const timestamp = new Date().toISOString();
  const cleanNote = params.note?.trim();
  const subject = `[MARS] Email Delivery Verification — ${params.organizationName}`;
  const text = [
    `MARS Transactional Email Test`,
    ``,
    `Organization: ${params.organizationName}`,
    `Provider: ${params.providerLabel}`,
    `Recipient: ${params.recipientEmail}`,
    `Triggered by: ${params.triggeredByEmail}`,
    `Timestamp (UTC): ${timestamp}`,
    ...(cleanNote ? [`Admin note: ${cleanNote}`] : []),
    ``,
    `This message confirms real end-to-end delivery from MARS Email Configuration.`
  ].join('\n');

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
    <div style="margin-bottom: 16px;">
      <span style="display:inline-block; background:#0f172a; color:#ffffff; font-weight:700; font-size:13px; padding:4px 10px; border-radius:6px;">MARS</span>
      <span style="margin-left:8px; font-size:12px; color:#64748b; font-weight:600;">Email Delivery Verification</span>
    </div>
    <h2 style="margin:0 0 8px 0; font-size:18px; color:#0f172a;">Transactional email delivery succeeded</h2>
    <p style="margin:0 0 16px 0; font-size:13px; color:#475569; line-height:1.5;">
      This verification email was dispatched directly by <strong>${params.organizationName}</strong> using <strong>${params.providerLabel}</strong>.
    </p>
    <table style="width:100%; border-collapse:collapse; font-size:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
      <tr><td style="padding:8px 12px; color:#64748b; width:130px;">Provider</td><td style="padding:8px 12px; font-weight:600; color:#0f172a;">${params.providerLabel}</td></tr>
      <tr><td style="padding:8px 12px; color:#64748b; border-top:1px solid #e2e8f0;">Triggered By</td><td style="padding:8px 12px; color:#0f172a; border-top:1px solid #e2e8f0;">${params.triggeredByEmail}</td></tr>
      <tr><td style="padding:8px 12px; color:#64748b; border-top:1px solid #e2e8f0;">Sent At (UTC)</td><td style="padding:8px 12px; font-family:monospace; color:#0f172a; border-top:1px solid #e2e8f0;">${timestamp}</td></tr>
      ${cleanNote ? `<tr><td style="padding:8px 12px; color:#64748b; border-top:1px solid #e2e8f0;">Note</td><td style="padding:8px 12px; color:#0f172a; border-top:1px solid #e2e8f0;">${cleanNote.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td></tr>` : ''}
    </table>
  </div>`;

  return { subject, text, html };
}

export function createEmailRouter(): express.Router {
  const router = express.Router();

  // Inspect provider readiness + (when authenticated admin passes organizationId) persisted org config & logs
  router.get('/email/status', async (req: Request, res: Response) => {
    try {
      const orgId = typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';
      const gmailAccessToken = getGmailAccessToken(req);
      let gmailSenderEmail: string | null = null;
      let validGmailToken: string | null = null;

      if (gmailAccessToken) {
        const profile = await inspectGmailProfile(gmailAccessToken);
        if (profile.emailAddress) {
          gmailSenderEmail = profile.emailAddress;
          validGmailToken = gmailAccessToken;
        }
      }

      if (orgId && req.headers.authorization?.startsWith('Bearer ')) {
        const { idToken } = await requireAdminCaller(req, orgId);
        const [config, logs] = await Promise.all([
          loadOrgEmailConfig(orgId, idToken),
          listOrgEmailLogs(orgId, idToken, 50)
        ]);
        const snapshot = buildEmailStatusSnapshot({
          activeProvider: config.activeProvider,
          allowFallback: config.allowFallback,
          fallbackProvider: config.fallbackProvider,
          gmailAccessToken: validGmailToken,
          gmailSenderEmail
        });
        return res.json({
          ...snapshot,
          config,
          logs
        });
      }

      return res.json(
        buildEmailStatusSnapshot({
          gmailAccessToken: validGmailToken,
          gmailSenderEmail
        })
      );
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      return res.status(status).json({
        errorCode: err?.errorCode || 'EMAIL_STATUS_ERROR',
        message: err?.message || 'Failed to inspect email provider status.'
      });
    }
  });

  // Update active transactional email provider & explicit fallback settings
  router.put('/email/config', async (req: Request, res: Response) => {
    try {
      const {
        organizationId,
        activeProvider,
        allowFallback = false,
        fallbackProvider = null,
        senderDisplayName
      } = req.body || {};

      if (!organizationId || typeof organizationId !== 'string') {
        return res.status(400).json({ errorCode: 'INVALID_REQUEST', message: 'organizationId is required.' });
      }
      if (!isValidProviderName(activeProvider)) {
        return res.status(400).json({
          errorCode: 'INVALID_PROVIDER',
          message: 'activeProvider must be one of: resend, gmail_oauth, or smtp.'
        });
      }
      if (fallbackProvider !== null && fallbackProvider !== undefined && !isValidProviderName(fallbackProvider)) {
        return res.status(400).json({
          errorCode: 'INVALID_FALLBACK_PROVIDER',
          message: 'fallbackProvider must be resend, gmail_oauth, smtp, or null.'
        });
      }
      if (allowFallback && fallbackProvider === activeProvider) {
        return res.status(400).json({
          errorCode: 'INVALID_FALLBACK_PROVIDER',
          message: 'Fallback provider must be different from the active provider.'
        });
      }

      const { idToken, fbUser } = await requireAdminCaller(req, organizationId);
      const savedConfig = await saveOrgEmailConfig(organizationId, idToken, fbUser.uid, {
        activeProvider,
        allowFallback: Boolean(allowFallback),
        fallbackProvider: allowFallback ? fallbackProvider : null,
        senderDisplayName
      });

      const gmailAccessToken = getGmailAccessToken(req);
      let gmailSenderEmail: string | null = null;
      let validGmailToken: string | null = null;
      if (gmailAccessToken) {
        const profile = await inspectGmailProfile(gmailAccessToken);
        if (profile.emailAddress) {
          gmailSenderEmail = profile.emailAddress;
          validGmailToken = gmailAccessToken;
        }
      }

      const snapshot = buildEmailStatusSnapshot({
        activeProvider: savedConfig.activeProvider,
        allowFallback: savedConfig.allowFallback,
        fallbackProvider: savedConfig.fallbackProvider,
        gmailAccessToken: validGmailToken,
        gmailSenderEmail
      });

      return res.json({
        ...snapshot,
        config: savedConfig,
        configurationWarning: snapshot.activeProviderConfigured ? null : snapshot.activeStatusMessage
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      return res.status(status).json({
        errorCode: err?.errorCode || 'EMAIL_CONFIG_ERROR',
        message: err?.message || 'Failed to save email provider configuration.'
      });
    }
  });

  // Send a real test email using the active provider (or explicit provider under test) & log result
  router.post('/email/test', async (req: Request, res: Response) => {
    try {
      const { organizationId, recipientEmail, providerOverride = null, note = '' } = req.body || {};
      if (!organizationId || typeof organizationId !== 'string') {
        return res.status(400).json({ errorCode: 'INVALID_REQUEST', message: 'organizationId is required.' });
      }

      const normalizedRecipient = normalizeEmail(recipientEmail);
      if (!isValidEmailAddress(normalizedRecipient)) {
        return res.status(400).json({
          errorCode: 'INVALID_EMAIL',
          message: 'Please provide a valid recipient email address for the test message.'
        });
      }

      if (providerOverride && !isValidProviderName(providerOverride)) {
        return res.status(400).json({ errorCode: 'INVALID_PROVIDER', message: 'Invalid providerOverride specified.' });
      }

      const { idToken, fbUser, orgDoc } = await requireAdminCaller(req, organizationId);
      const currentConfig = await loadOrgEmailConfig(organizationId, idToken);
      const targetProvider: EmailProviderName =
        (providerOverride as EmailProviderName | null) || currentConfig.activeProvider;
      const gmailAccessToken = getGmailAccessToken(req);

      const diag = validateProviderConfig(targetProvider, { gmailAccessToken });
      if (!diag.configured && (!currentConfig.allowFallback || providerOverride)) {
        const failureResult = {
          ok: false as const,
          provider: targetProvider,
          errorCode: targetProvider === 'gmail_oauth' ? ('SENDER_AUTH_FAILED' as const) : ('EMAIL_NOT_CONFIGURED' as const),
          errorMessage: diag.statusMessage,
          fallbackUsed: false,
          fallbackFromProvider: null,
          attempts: [
            {
              attemptAt: new Date().toISOString(),
              provider: targetProvider,
              status: 'failed' as const,
              messageId: null,
              senderEmail: diag.senderAddress,
              errorCode: targetProvider === 'gmail_oauth' ? 'SENDER_AUTH_FAILED' : 'EMAIL_NOT_CONFIGURED',
              errorMessage: diag.statusMessage
            }
          ]
        };
        const recorded = await recordEmailDeliveryOutcome({
          orgId: organizationId,
          idToken,
          actorUid: fbUser.uid,
          recipientEmail: normalizedRecipient,
          subject: `[MARS] Email Delivery Verification — ${orgDoc.name || 'MARS'}`,
          category: 'test',
          idempotencyKey: `test:${organizationId}:${Date.now()}`,
          result: failureResult,
          currentConfig
        });

        return res.status(400).json({
          delivered: false,
          errorCode: failureResult.errorCode,
          message: diag.statusMessage,
          log: recorded.log,
          config: recorded.config
        });
      }

      const providerLabel = diag.label;
      const rendered = buildTestEmailPayload({
        organizationName: orgDoc.name || 'MARS',
        recipientEmail: normalizedRecipient,
        providerLabel,
        triggeredByEmail: fbUser.email,
        note: typeof note === 'string' ? note : ''
      });

      const idempotencyKey = `test:${organizationId}:${fbUser.uid}:${Date.now()}`;
      const sendResult = await sendTransactionalEmail({
        toEmail: normalizedRecipient,
        email: rendered,
        gmailAccessToken: gmailAccessToken || null,
        idempotencyKey,
        policy: {
          activeProvider: currentConfig.activeProvider,
          allowFallback: currentConfig.allowFallback,
          fallbackProvider: currentConfig.fallbackProvider
        },
        explicitProvider: (providerOverride as EmailProviderName | null) || null
      });

      const recorded = await recordEmailDeliveryOutcome({
        orgId: organizationId,
        idToken,
        actorUid: fbUser.uid,
        recipientEmail: normalizedRecipient,
        subject: rendered.subject,
        category: 'test',
        idempotencyKey,
        result: sendResult,
        currentConfig
      });

      if (!sendResult.ok) {
        return res.status(502).json({
          delivered: false,
          errorCode: sendResult.errorCode,
          message: sendResult.errorMessage,
          log: recorded.log,
          config: recorded.config
        });
      }

      return res.json({
        delivered: true,
        provider: sendResult.provider,
        messageId: sendResult.messageId,
        senderEmail: sendResult.senderEmail,
        acceptedAt: sendResult.acceptedAt,
        deliveryNote: sendResult.deliveryNote,
        fallbackUsed: sendResult.fallbackUsed,
        log: recorded.log,
        config: recorded.config
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      return res.status(status).json({
        errorCode: err?.errorCode || 'TEST_EMAIL_ERROR',
        message: err?.message || 'Failed to execute test email delivery.'
      });
    }
  });

  // Retry a failed email log entry with strict duplicate-delivery protection
  router.post('/email/logs/:logId/retry', async (req: Request, res: Response) => {
    try {
      const { logId } = req.params;
      const { organizationId } = req.body || {};
      if (!organizationId || !logId) {
        return res.status(400).json({ errorCode: 'INVALID_REQUEST', message: 'organizationId and logId are required.' });
      }

      const { idToken, fbUser, orgDoc } = await requireAdminCaller(req, organizationId);
      const logEntry = await fsGetDoc<StoredEmailDeliveryLog>(
        `organizations/${organizationId}/emailLogs/${logId}`,
        idToken
      );

      if (!logEntry) {
        return res.status(404).json({ errorCode: 'NOT_FOUND', message: 'Email delivery log entry not found.' });
      }
      if (logEntry.status === 'sent') {
        return res.status(409).json({
          errorCode: 'DUPLICATE_DELIVERY_PREVENTED',
          message: `This email was already delivered (${logEntry.messageId || 'sent'}). Duplicate retry blocked.`
        });
      }
      if (logEntry.retriedByLogId) {
        const existingRetry = await fsGetDoc<StoredEmailDeliveryLog>(
          `organizations/${organizationId}/emailLogs/${logEntry.retriedByLogId}`,
          idToken
        ).catch(() => null);
        if (existingRetry?.status === 'sent') {
          return res.status(409).json({
            errorCode: 'DUPLICATE_DELIVERY_PREVENTED',
            message: 'This failed email already succeeded on a subsequent retry.'
          });
        }
      }

      if (logEntry.category === 'invitation' && logEntry.relatedInvitationId) {
        return res.status(409).json({
          errorCode: 'USE_INVITATION_RESEND',
          relatedInvitationId: logEntry.relatedInvitationId,
          message: 'Please retry failed invitation deliveries via Invitation Resend so a fresh secure verification code is issued.'
        });
      }

      const currentConfig = await loadOrgEmailConfig(organizationId, idToken);
      const diag = validateProviderConfig(currentConfig.activeProvider, {
        gmailAccessToken: getGmailAccessToken(req)
      });
      const rendered = buildTestEmailPayload({
        organizationName: orgDoc.name || 'MARS',
        recipientEmail: logEntry.recipientEmail,
        providerLabel: diag.label,
        triggeredByEmail: fbUser.email,
        note: `Retry of failed delivery log ${logId}`
      });

      const retryIdempotencyKey = `retry:${logId}:${Date.now()}`;
      const sendResult = await sendTransactionalEmail({
        toEmail: logEntry.recipientEmail,
        email: rendered,
        gmailAccessToken: getGmailAccessToken(req) || null,
        idempotencyKey: retryIdempotencyKey,
        policy: {
          activeProvider: currentConfig.activeProvider,
          allowFallback: currentConfig.allowFallback,
          fallbackProvider: currentConfig.fallbackProvider
        }
      });

      const recorded = await recordEmailDeliveryOutcome({
        orgId: organizationId,
        idToken,
        actorUid: fbUser.uid,
        recipientEmail: logEntry.recipientEmail,
        subject: rendered.subject,
        category: logEntry.category,
        relatedInvitationId: logEntry.relatedInvitationId,
        idempotencyKey: retryIdempotencyKey,
        retriedFromLogId: logId,
        result: sendResult,
        currentConfig
      });

      if (!sendResult.ok) {
        return res.status(502).json({
          delivered: false,
          errorCode: sendResult.errorCode,
          message: sendResult.errorMessage,
          log: recorded.log,
          config: recorded.config
        });
      }

      return res.json({
        delivered: true,
        log: recorded.log,
        config: recorded.config
      });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
      return res.status(status).json({
        errorCode: err?.errorCode || 'RETRY_ERROR',
        message: err?.message || 'Failed to retry email delivery.'
      });
    }
  });

  return router;
}
