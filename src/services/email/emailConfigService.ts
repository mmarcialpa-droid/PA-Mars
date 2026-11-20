import { auth } from '../firebase/firebase';
import {
  EmailDeliveryLog,
  EmailProviderId,
  EmailProviderStatus,
  OrganizationEmailConfig
} from '../../types';

export interface EmailTestResponse {
  delivered: boolean;
  provider?: EmailProviderId;
  messageId?: string;
  senderEmail?: string;
  acceptedAt?: string;
  deliveryNote?: string;
  fallbackUsed?: boolean;
  errorCode?: string;
  message?: string;
  log?: EmailDeliveryLog;
  config?: OrganizationEmailConfig;
}

export class EmailServiceApiError extends Error {
  errorCode: string;
  statusCode: number;
  relatedInvitationId?: string;
  log?: EmailDeliveryLog;
  config?: OrganizationEmailConfig;

  constructor(
    message: string,
    opts: {
      errorCode?: string;
      statusCode?: number;
      relatedInvitationId?: string;
      log?: EmailDeliveryLog;
      config?: OrganizationEmailConfig;
    } = {}
  ) {
    super(message);
    this.name = 'EmailServiceApiError';
    this.errorCode = opts.errorCode || 'EMAIL_SERVICE_ERROR';
    this.statusCode = opts.statusCode || 500;
    this.relatedInvitationId = opts.relatedInvitationId;
    this.log = opts.log;
    this.config = opts.config;
  }
}

async function getCallerIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required. Please sign in again.');
  }
  return user.getIdToken();
}

async function parseJson(res: Response, fallbackMessage: string): Promise<Record<string, any>> {
  const text = await res.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {};
  } catch {
    throw new EmailServiceApiError(
      `${fallbackMessage} (unexpected non-JSON response, HTTP ${res.status}).`,
      { errorCode: 'INVALID_API_RESPONSE', statusCode: res.status || 502 }
    );
  }
}

export const emailConfigService = {
  async getStatus(
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

    const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : '';
    const res = await fetch(`/api/email/status${query}`, { headers });
    const body = await parseJson(res, 'Could not load email configuration status.');
    if (!res.ok) {
      throw new EmailServiceApiError(body?.message || 'Could not load email configuration status.', {
        errorCode: body?.errorCode,
        statusCode: res.status
      });
    }
    return body as EmailProviderStatus;
  },

  async updateConfig(
    orgId: string,
    payload: {
      activeProvider: EmailProviderId;
      allowFallback: boolean;
      fallbackProvider: EmailProviderId | null;
      senderDisplayName?: string;
    },
    gmailAccessToken?: string | null
  ): Promise<EmailProviderStatus & { configurationWarning?: string | null }> {
    const idToken = await getCallerIdToken();
    const res = await fetch('/api/email/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(gmailAccessToken ? { 'X-Gmail-Access-Token': gmailAccessToken } : {})
      },
      body: JSON.stringify({
        organizationId: orgId,
        ...payload
      })
    });
    const body = await parseJson(res, 'Could not save email provider settings.');
    if (!res.ok) {
      throw new EmailServiceApiError(body?.message || 'Could not save email provider settings.', {
        errorCode: body?.errorCode,
        statusCode: res.status
      });
    }
    return body as EmailProviderStatus & { configurationWarning?: string | null };
  },

  async sendTestEmail(
    orgId: string,
    payload: {
      recipientEmail: string;
      providerOverride?: EmailProviderId | null;
      note?: string;
    },
    gmailAccessToken?: string | null
  ): Promise<EmailTestResponse> {
    const idToken = await getCallerIdToken();
    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(gmailAccessToken ? { 'X-Gmail-Access-Token': gmailAccessToken } : {})
      },
      body: JSON.stringify({
        organizationId: orgId,
        ...payload
      })
    });
    const body = await parseJson(res, 'Test email delivery failed.');
    if (!res.ok) {
      throw new EmailServiceApiError(body?.message || 'Test email delivery failed.', {
        errorCode: body?.errorCode,
        statusCode: res.status,
        log: body?.log,
        config: body?.config
      });
    }
    return body as EmailTestResponse;
  },

  async retryFailedLog(
    orgId: string,
    logId: string,
    gmailAccessToken?: string | null
  ): Promise<{ delivered: boolean; log: EmailDeliveryLog; config?: OrganizationEmailConfig }> {
    const idToken = await getCallerIdToken();
    const res = await fetch(`/api/email/logs/${encodeURIComponent(logId)}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(gmailAccessToken ? { 'X-Gmail-Access-Token': gmailAccessToken } : {})
      },
      body: JSON.stringify({ organizationId: orgId })
    });
    const body = await parseJson(res, 'Retry email delivery failed.');
    if (!res.ok) {
      throw new EmailServiceApiError(body?.message || 'Retry email delivery failed.', {
        errorCode: body?.errorCode,
        statusCode: res.status,
        relatedInvitationId: body?.relatedInvitationId,
        log: body?.log,
        config: body?.config
      });
    }
    return body as { delivered: boolean; log: EmailDeliveryLog; config?: OrganizationEmailConfig };
  }
};
