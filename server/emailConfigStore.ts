import { generateId } from './invitationCrypto.ts';
import {
  DEFAULT_EMAIL_PROVIDER,
  isValidProviderName,
  type EmailProviderName,
  type SendEmailResult
} from './emailService.ts';
import {
  fsCommitWrites,
  fsGetDoc,
  fsListCollectionDesc,
  fsSetDoc,
  type CommitWrite
} from './firestoreRest.ts';

export interface StoredEmailConfig {
  id: 'default';
  organizationId: string;
  activeProvider: EmailProviderName;
  allowFallback: boolean;
  fallbackProvider: EmailProviderName | null;
  senderDisplayName?: string;
  lastDeliveryStatus: 'never' | 'sent' | 'failed';
  lastSuccessfulDeliveryAt: string | null;
  lastSuccessfulProvider: string | null;
  lastSuccessfulSender: string | null;
  lastErrorAt: string | null;
  lastErrorProvider: string | null;
  lastErrorMessage: string | null;
  updatedBy: string;
  updatedAt: string;
}

export interface StoredEmailDeliveryLog {
  id: string;
  organizationId: string;
  recipientEmail: string;
  subject: string;
  category: 'invitation' | 'test' | 'system';
  relatedInvitationId: string | null;
  idempotencyKey: string;
  provider: EmailProviderName | 'none';
  fallbackUsed: boolean;
  fallbackFromProvider: string | null;
  senderEmail: string | null;
  status: 'sent' | 'failed';
  messageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retriedFromLogId: string | null;
  retriedByLogId: string | null;
  triggeredBy: string;
  createdAt: string;
  updatedAt: string;
}

export function defaultOrgEmailConfig(orgId: string): StoredEmailConfig {
  return {
    id: 'default',
    organizationId: orgId,
    activeProvider: DEFAULT_EMAIL_PROVIDER,
    allowFallback: false,
    fallbackProvider: null,
    senderDisplayName: 'MARS Workspace',
    lastDeliveryStatus: 'never',
    lastSuccessfulDeliveryAt: null,
    lastSuccessfulProvider: null,
    lastSuccessfulSender: null,
    lastErrorAt: null,
    lastErrorProvider: null,
    lastErrorMessage: null,
    updatedBy: 'system',
    updatedAt: new Date().toISOString()
  };
}

function sanitizeEmailConfig(orgId: string, raw?: Partial<StoredEmailConfig> | null): StoredEmailConfig {
  const base = defaultOrgEmailConfig(orgId);
  const src = raw || {};
  const activeProvider = isValidProviderName(src.activeProvider)
    ? src.activeProvider
    : base.activeProvider;
  const allowFallback = Boolean(src.allowFallback);
  const rawFallback = isValidProviderName(src.fallbackProvider) ? src.fallbackProvider : null;
  const fallbackProvider = allowFallback && rawFallback && rawFallback !== activeProvider ? rawFallback : null;

  return {
    id: 'default',
    organizationId: orgId.slice(0, 128),
    activeProvider,
    allowFallback,
    fallbackProvider,
    senderDisplayName:
      typeof src.senderDisplayName === 'string' && src.senderDisplayName.trim()
        ? src.senderDisplayName.trim().slice(0, 120)
        : base.senderDisplayName,
    lastDeliveryStatus:
      src.lastDeliveryStatus === 'sent' || src.lastDeliveryStatus === 'failed'
        ? src.lastDeliveryStatus
        : 'never',
    lastSuccessfulDeliveryAt:
      typeof src.lastSuccessfulDeliveryAt === 'string' ? src.lastSuccessfulDeliveryAt : null,
    lastSuccessfulProvider:
      typeof src.lastSuccessfulProvider === 'string' ? src.lastSuccessfulProvider : null,
    lastSuccessfulSender:
      typeof src.lastSuccessfulSender === 'string' ? src.lastSuccessfulSender : null,
    lastErrorAt: typeof src.lastErrorAt === 'string' ? src.lastErrorAt : null,
    lastErrorProvider:
      typeof src.lastErrorProvider === 'string' ? src.lastErrorProvider : null,
    lastErrorMessage:
      typeof src.lastErrorMessage === 'string' ? src.lastErrorMessage.slice(0, 1000) : null,
    updatedBy: typeof src.updatedBy === 'string' ? src.updatedBy.slice(0, 128) : base.updatedBy,
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : base.updatedAt
  };
}

export async function loadOrgEmailConfig(
  orgId: string,
  idToken: string
): Promise<StoredEmailConfig> {
  const existing = await fsGetDoc<StoredEmailConfig>(
    `organizations/${orgId}/emailConfig/default`,
    idToken
  ).catch(() => null);

  return sanitizeEmailConfig(orgId, existing);
}

export async function saveOrgEmailConfig(
  orgId: string,
  idToken: string,
  actorUid: string,
  updates: {
    activeProvider: EmailProviderName;
    allowFallback: boolean;
    fallbackProvider: EmailProviderName | null;
    senderDisplayName?: string;
  }
): Promise<StoredEmailConfig> {
  const current = await loadOrgEmailConfig(orgId, idToken);
  const cleanFallback =
    updates.allowFallback &&
    updates.fallbackProvider &&
    updates.fallbackProvider !== updates.activeProvider
      ? updates.fallbackProvider
      : null;

  const nextConfig = sanitizeEmailConfig(orgId, {
    ...current,
    activeProvider: updates.activeProvider,
    allowFallback: Boolean(updates.allowFallback),
    fallbackProvider: cleanFallback,
    senderDisplayName:
      typeof updates.senderDisplayName === 'string' && updates.senderDisplayName.trim()
        ? updates.senderDisplayName.trim().slice(0, 120)
        : current.senderDisplayName || 'MARS Workspace',
    updatedBy: actorUid,
    updatedAt: new Date().toISOString()
  });

  await fsSetDoc(
    `organizations/${orgId}/emailConfig/default`,
    nextConfig as unknown as Record<string, unknown>,
    idToken
  );

  return nextConfig;
}

export async function listOrgEmailLogs(
  orgId: string,
  idToken: string,
  limitCount = 50
): Promise<StoredEmailDeliveryLog[]> {
  return fsListCollectionDesc<StoredEmailDeliveryLog>(
    `organizations/${orgId}/emailLogs`,
    'createdAt',
    limitCount,
    idToken
  ).catch(() => []);
}

export async function recordEmailDeliveryOutcome(params: {
  orgId: string;
  idToken: string;
  actorUid: string;
  recipientEmail: string;
  subject: string;
  category: 'invitation' | 'test' | 'system';
  relatedInvitationId?: string | null;
  idempotencyKey: string;
  retriedFromLogId?: string | null;
  result: SendEmailResult;
  currentConfig?: StoredEmailConfig;
}): Promise<{ log: StoredEmailDeliveryLog; config: StoredEmailConfig }> {
  const nowIso = new Date().toISOString();
  const logId = generateId('elog');
  const existingConfig = params.currentConfig
    ? sanitizeEmailConfig(params.orgId, params.currentConfig)
    : await loadOrgEmailConfig(params.orgId, params.idToken);

  const logEntry: StoredEmailDeliveryLog = {
    id: logId,
    organizationId: params.orgId.slice(0, 128),
    recipientEmail: params.recipientEmail.slice(0, 200),
    subject: params.subject.slice(0, 300),
    category: params.category,
    relatedInvitationId: params.relatedInvitationId || null,
    idempotencyKey: params.idempotencyKey.slice(0, 200),
    provider: params.result.provider,
    fallbackUsed: Boolean(params.result.fallbackUsed),
    fallbackFromProvider: params.result.fallbackFromProvider || null,
    senderEmail: params.result.ok
      ? params.result.senderEmail
      : params.result.attempts?.[0]?.senderEmail || null,
    status: params.result.ok ? 'sent' : 'failed',
    messageId: params.result.ok ? params.result.messageId : null,
    errorCode: params.result.ok ? null : params.result.errorCode,
    errorMessage: params.result.ok ? null : params.result.errorMessage.slice(0, 1000),
    retriedFromLogId: params.retriedFromLogId || null,
    retriedByLogId: null,
    triggeredBy: params.actorUid,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const nextConfig = sanitizeEmailConfig(
    params.orgId,
    params.result.ok
      ? {
          ...existingConfig,
          lastDeliveryStatus: 'sent',
          lastSuccessfulDeliveryAt: params.result.acceptedAt || nowIso,
          lastSuccessfulProvider: params.result.provider,
          lastSuccessfulSender: params.result.senderEmail,
          updatedBy: params.actorUid,
          updatedAt: nowIso
        }
      : {
          ...existingConfig,
          lastDeliveryStatus: 'failed',
          lastErrorAt: nowIso,
          lastErrorProvider: params.result.provider,
          lastErrorMessage: params.result.errorMessage.slice(0, 1000),
          updatedBy: params.actorUid,
          updatedAt: nowIso
        }
  );

  const writes: CommitWrite[] = [
    {
      type: 'set',
      docPath: `organizations/${params.orgId}/emailLogs/${logId}`,
      data: logEntry as unknown as Record<string, unknown>,
      currentDocument: { exists: false }
    },
    {
      type: 'set',
      docPath: `organizations/${params.orgId}/emailConfig/default`,
      data: nextConfig as unknown as Record<string, unknown>
    }
  ];

  if (params.retriedFromLogId) {
    writes.push({
      type: 'update',
      docPath: `organizations/${params.orgId}/emailLogs/${params.retriedFromLogId}`,
      data: {
        retriedByLogId: logId,
        updatedAt: nowIso
      }
    });
  }

  await fsCommitWrites(writes, params.idToken);

  return { log: logEntry, config: nextConfig };
}
