import nodemailer from 'nodemailer';
import type { RenderedInvitationEmail } from './emailTemplate.ts';

export type EmailProviderName = 'resend' | 'gmail_oauth' | 'smtp';

export interface EmailProviderDiagnostic {
  provider: EmailProviderName;
  label: string;
  description: string;
  configured: boolean;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  senderAddress: string | null;
  statusMessage: string;
}

export interface EmailProviderConfigPolicy {
  activeProvider: EmailProviderName;
  allowFallback: boolean;
  fallbackProvider: EmailProviderName | null;
}

export interface SendTransactionalEmailParams {
  toEmail: string;
  toName?: string;
  email: RenderedInvitationEmail;
  gmailAccessToken?: string | null;
  idempotencyKey?: string;
  policy?: Partial<EmailProviderConfigPolicy>;
  explicitProvider?: EmailProviderName | null;
}

export interface DispatchAttemptRecord {
  attemptAt: string;
  provider: EmailProviderName | 'none';
  status: 'sent' | 'failed';
  messageId: string | null;
  senderEmail: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SendEmailSuccess {
  ok: true;
  provider: EmailProviderName;
  messageId: string;
  senderEmail: string;
  acceptedAt: string;
  deliveryNote: string;
  fallbackUsed: boolean;
  fallbackFromProvider: EmailProviderName | null;
  attempts: DispatchAttemptRecord[];
}

export interface SendEmailFailure {
  ok: false;
  provider: EmailProviderName | 'none';
  errorCode:
    | 'EMAIL_NOT_CONFIGURED'
    | 'SENDER_AUTH_FAILED'
    | 'PROVIDER_REJECTED'
    | 'RATE_LIMITED'
    | 'NETWORK_ERROR'
    | 'DUPLICATE_DELIVERY_PREVENTED';
  errorMessage: string;
  fallbackUsed: boolean;
  fallbackFromProvider: EmailProviderName | null;
  attempts: DispatchAttemptRecord[];
}

export type SendEmailResult = SendEmailSuccess | SendEmailFailure;

export const DEFAULT_EMAIL_PROVIDER: EmailProviderName = 'resend';

// Process-scoped duplicate prevention (in-flight lock + 15-minute idempotency window)
const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
const inFlightIdempotencyKeys = new Set<string>();
const completedDeliveries = new Map<
  string,
  { messageId: string; provider: EmailProviderName; completedAtMs: number }
>();

function pruneCompletedDeliveries() {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [key, entry] of completedDeliveries.entries()) {
    if (entry.completedAtMs < cutoff) {
      completedDeliveries.delete(key);
    }
  }
}

export function isValidProviderName(value: unknown): value is EmailProviderName {
  return value === 'resend' || value === 'gmail_oauth' || value === 'smtp';
}

export function validateProviderConfig(
  provider: EmailProviderName,
  opts?: { gmailAccessToken?: string | null; gmailSenderEmail?: string | null }
): EmailProviderDiagnostic {
  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY?.trim() || '';
    const from = process.env.RESEND_FROM?.trim() || '';
    const missingEnvVars: string[] = [];
    if (!apiKey) missingEnvVars.push('RESEND_API_KEY');
    if (!from) missingEnvVars.push('RESEND_FROM');

    const configured = missingEnvVars.length === 0;
    return {
      provider: 'resend',
      label: 'Resend API (Default)',
      description: 'Automated system transactional emails via Resend REST API.',
      configured,
      requiredEnvVars: ['RESEND_API_KEY', 'RESEND_FROM'],
      missingEnvVars,
      senderAddress: from || null,
      statusMessage: configured
        ? `Ready — sending from ${from}.`
        : `Missing required environment variable(s): ${missingEnvVars.join(', ')}.`
    };
  }

  if (provider === 'gmail_oauth') {
    const hasToken = Boolean(opts?.gmailAccessToken?.trim());
    const sender = opts?.gmailSenderEmail?.trim() || null;
    return {
      provider: 'gmail_oauth',
      label: 'Gmail OAuth 2.0',
      description:
        'User-authorized Google Workspace Gmail delivery using gmail.send permission (no SMTP credentials required).',
      configured: hasToken,
      requiredEnvVars: [],
      missingEnvVars: [],
      senderAddress: sender,
      statusMessage: hasToken
        ? `Authorized${sender ? ` as ${sender}` : ''} for this session.`
        : 'Requires one-time Gmail sender authorization by an administrator in this session.'
    };
  }

  // SMTP (Optional alternative provider — never checked unless selected or explicitly tested)
  const host = process.env.SMTP_HOST?.trim() || '';
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASS?.trim() || '';
  const from = process.env.SMTP_FROM?.trim() || user;
  const missingEnvVars: string[] = [];
  if (!host) missingEnvVars.push('SMTP_HOST');
  if (!user) missingEnvVars.push('SMTP_USER');
  if (!pass) missingEnvVars.push('SMTP_PASS');
  if (!from) missingEnvVars.push('SMTP_FROM');

  const configured = missingEnvVars.length === 0;
  return {
    provider: 'smtp',
    label: 'Custom SMTP',
    description: 'Optional authenticated SMTP relay configured via server environment variables.',
    configured,
    requiredEnvVars: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
    missingEnvVars,
    senderAddress: from || null,
    statusMessage: configured
      ? `Ready — relay ${host} sending as ${from}.`
      : `Optional SMTP not configured (missing: ${missingEnvVars.join(', ')}).`
  };
}

export function getAllProviderDiagnostics(opts?: {
  gmailAccessToken?: string | null;
  gmailSenderEmail?: string | null;
}): Record<EmailProviderName, EmailProviderDiagnostic> {
  return {
    resend: validateProviderConfig('resend', opts),
    gmail_oauth: validateProviderConfig('gmail_oauth', opts),
    smtp: validateProviderConfig('smtp', opts)
  };
}

export function buildEmailStatusSnapshot(params?: {
  activeProvider?: EmailProviderName;
  allowFallback?: boolean;
  fallbackProvider?: EmailProviderName | null;
  gmailAccessToken?: string | null;
  gmailSenderEmail?: string | null;
}) {
  const activeProvider: EmailProviderName = isValidProviderName(params?.activeProvider)
    ? params!.activeProvider
    : DEFAULT_EMAIL_PROVIDER;
  const allowFallback = Boolean(params?.allowFallback);
  const fallbackProvider =
    allowFallback &&
    isValidProviderName(params?.fallbackProvider) &&
    params?.fallbackProvider !== activeProvider
      ? params!.fallbackProvider
      : null;

  const providers = getAllProviderDiagnostics({
    gmailAccessToken: params?.gmailAccessToken,
    gmailSenderEmail: params?.gmailSenderEmail
  });
  const activeDiag = providers[activeProvider];

  return {
    defaultProvider: DEFAULT_EMAIL_PROVIDER,
    activeProvider,
    activeProviderConfigured: activeDiag.configured,
    activeSenderAddress: activeDiag.senderAddress,
    activeStatusMessage: activeDiag.statusMessage,
    allowFallback,
    fallbackProvider,
    gmailOAuthSupported: true,
    providers,
    serverProviders: {
      resend: providers.resend.configured,
      smtp: providers.smtp.configured
    },
    defaultServerProvider: providers.resend.configured
      ? ('resend' as EmailProviderName)
      : providers.smtp.configured
      ? ('smtp' as EmailProviderName)
      : null
  };
}

function encodeMimeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function buildRawMimeMessage(params: {
  fromEmail: string;
  toEmail: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
}): string {
  const boundary = `mars_bnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const recipientHeader = params.toName?.trim()
    ? `${encodeMimeHeader(params.toName.trim())} <${params.toEmail}>`
    : params.toEmail;

  const lines = [
    `From: MARS Workspace <${params.fromEmail}>`,
    `To: ${recipientHeader}`,
    `Subject: ${encodeMimeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(params.text, 'utf8').toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(params.html, 'utf8').toString('base64'),
    '',
    `--${boundary}--`
  ];

  return Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendViaResend(
  params: SendTransactionalEmailParams,
  idempotencyKey?: string
): Promise<DispatchAttemptRecord & { ok: boolean; deliveryNote?: string; errorCode?: SendEmailFailure['errorCode'] | null }> {
  const diag = validateProviderConfig('resend');
  if (!diag.configured) {
    return {
      ok: false,
      attemptAt: new Date().toISOString(),
      provider: 'resend',
      status: 'failed',
      messageId: null,
      senderEmail: diag.senderAddress,
      errorCode: 'EMAIL_NOT_CONFIGURED',
      errorMessage: `Resend is the selected provider but is missing server environment variable(s): ${diag.missingEnvVars.join(', ')}. Configure them in your server environment or switch provider in Settings -> Email Configuration.`
    };
  }

  const apiKey = process.env.RESEND_API_KEY!.trim();
  const fromEmail = process.env.RESEND_FROM!.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 250) } : {})
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.toEmail],
        subject: params.email.subject,
        text: params.email.text,
        html: params.email.html
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorCode: SendEmailFailure['errorCode'] =
        res.status === 401 || res.status === 403
          ? 'SENDER_AUTH_FAILED'
          : res.status === 429
          ? 'RATE_LIMITED'
          : 'PROVIDER_REJECTED';
      return {
        ok: false,
        attemptAt: new Date().toISOString(),
        provider: 'resend',
        status: 'failed',
        messageId: null,
        senderEmail: fromEmail,
        errorCode,
        errorMessage: data?.message || `Resend rejected message (HTTP ${res.status}).`
      };
    }

    const messageId = String(data?.id || `resend_${Date.now()}`);
    const acceptedAt = new Date().toISOString();
    return {
      ok: true,
      attemptAt: acceptedAt,
      provider: 'resend',
      status: 'sent',
      messageId,
      senderEmail: fromEmail,
      errorCode: null,
      errorMessage: null,
      deliveryNote: `Accepted for delivery by Resend (${fromEmail}); Message ID ${messageId}.`
    };
  } catch (err: unknown) {
    return {
      ok: false,
      attemptAt: new Date().toISOString(),
      provider: 'resend',
      status: 'failed',
      messageId: null,
      senderEmail: fromEmail,
      errorCode: 'NETWORK_ERROR',
      errorMessage: err instanceof Error ? err.message : 'Network error calling Resend API.'
    };
  }
}

export async function inspectGmailProfile(accessToken: string): Promise<{ emailAddress: string | null; error?: string }> {
  try {
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!profileRes.ok) {
      const errBody = await profileRes.json().catch(() => ({}));
      return {
        emailAddress: null,
        error: errBody?.error?.message || `Gmail profile lookup failed (${profileRes.status}).`
      };
    }
    const profile = (await profileRes.json()) as { emailAddress?: string };
    return { emailAddress: profile.emailAddress || null };
  } catch (err: unknown) {
    return {
      emailAddress: null,
      error: err instanceof Error ? err.message : 'Network error contacting Gmail API.'
    };
  }
}

async function sendViaGmailOAuth(
  params: SendTransactionalEmailParams
): Promise<DispatchAttemptRecord & { ok: boolean; deliveryNote?: string; errorCode?: SendEmailFailure['errorCode'] | null }> {
  const accessToken = params.gmailAccessToken?.trim() || '';
  if (!accessToken) {
    return {
      ok: false,
      attemptAt: new Date().toISOString(),
      provider: 'gmail_oauth',
      status: 'failed',
      messageId: null,
      senderEmail: null,
      errorCode: 'SENDER_AUTH_FAILED',
      errorMessage:
        'Gmail OAuth session is not connected. Authorize your Google Workspace Gmail sender once in Settings -> Email Configuration or the Invitations header.'
    };
  }

  try {
    const profileCheck = await inspectGmailProfile(accessToken);
    if (!profileCheck.emailAddress) {
      return {
        ok: false,
        attemptAt: new Date().toISOString(),
        provider: 'gmail_oauth',
        status: 'failed',
        messageId: null,
        senderEmail: null,
        errorCode: 'SENDER_AUTH_FAILED',
        errorMessage:
          profileCheck.error ||
          'Gmail authorization expired or missing gmail.send permission. Refresh your Gmail authorization.'
      };
    }

    const senderEmail = profileCheck.emailAddress;
    const raw = buildRawMimeMessage({
      fromEmail: senderEmail,
      toEmail: params.toEmail,
      toName: params.toName,
      subject: params.email.subject,
      text: params.email.text,
      html: params.email.html
    });

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    const sendData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      const detail = sendData?.error?.message || `Gmail send API returned HTTP ${sendRes.status}.`;
      const errorCode: SendEmailFailure['errorCode'] =
        sendRes.status === 401 || sendRes.status === 403
          ? 'SENDER_AUTH_FAILED'
          : sendRes.status === 429
          ? 'RATE_LIMITED'
          : 'PROVIDER_REJECTED';
      return {
        ok: false,
        attemptAt: new Date().toISOString(),
        provider: 'gmail_oauth',
        status: 'failed',
        messageId: null,
        senderEmail,
        errorCode,
        errorMessage: detail
      };
    }

    const messageId = String(sendData?.id || `gmail_${Date.now()}`);
    const acceptedAt = new Date().toISOString();
    return {
      ok: true,
      attemptAt: acceptedAt,
      provider: 'gmail_oauth',
      status: 'sent',
      messageId,
      senderEmail,
      errorCode: null,
      errorMessage: null,
      deliveryNote: `Accepted for delivery by Gmail API (${senderEmail}); Message ID ${messageId}.`
    };
  } catch (err: unknown) {
    return {
      ok: false,
      attemptAt: new Date().toISOString(),
      provider: 'gmail_oauth',
      status: 'failed',
      messageId: null,
      senderEmail: null,
      errorCode: 'NETWORK_ERROR',
      errorMessage: err instanceof Error ? err.message : 'Network error calling Gmail API.'
    };
  }
}

async function sendViaSmtp(
  params: SendTransactionalEmailParams
): Promise<DispatchAttemptRecord & { ok: boolean; deliveryNote?: string; errorCode?: SendEmailFailure['errorCode'] | null }> {
  const diag = validateProviderConfig('smtp');
  if (!diag.configured) {
    return {
      ok: false,
      attemptAt: new Date().toISOString(),
      provider: 'smtp',
      status: 'failed',
      messageId: null,
      senderEmail: diag.senderAddress,
      errorCode: 'EMAIL_NOT_CONFIGURED',
      errorMessage: `SMTP is selected, but required environment variable(s) are missing: ${diag.missingEnvVars.join(', ')}.`
    };
  }

  const host = process.env.SMTP_HOST!.trim();
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const port = Number(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from,
      to: params.toName ? `"${params.toName}" <${params.toEmail}>` : params.toEmail,
      subject: params.email.subject,
      text: params.email.text,
      html: params.email.html
    });

    const messageId = info.messageId || `smtp_${Date.now()}`;
    const acceptedAt = new Date().toISOString();
    return {
      ok: true,
      attemptAt: acceptedAt,
      provider: 'smtp',
      status: 'sent',
      messageId,
      senderEmail: from,
      errorCode: null,
      errorMessage: null,
      deliveryNote: `Accepted by SMTP relay (${host}); Message ID ${messageId}.`
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'SMTP delivery failed.';
    const lower = msg.toLowerCase();
    return {
      ok: false,
      attemptAt: new Date().toISOString(),
      provider: 'smtp',
      status: 'failed',
      messageId: null,
      senderEmail: from,
      errorCode:
        lower.includes('auth') || lower.includes('credentials') || lower.includes('535')
          ? 'SENDER_AUTH_FAILED'
          : 'PROVIDER_REJECTED',
      errorMessage: msg
    };
  }
}

async function executeSingleProvider(
  provider: EmailProviderName,
  params: SendTransactionalEmailParams,
  idempotencyKey?: string
) {
  if (provider === 'resend') {
    return sendViaResend(params, idempotencyKey);
  }
  if (provider === 'gmail_oauth') {
    return sendViaGmailOAuth(params);
  }
  return sendViaSmtp(params);
}

/**
 * Centralized transactional email dispatcher.
 * - Uses the active configured provider (Resend by default).
 * - Prevents duplicate deliveries via idempotency key tracking.
 * - NEVER silently switches providers unless policy.allowFallback === true and fallbackProvider is explicitly set.
 */
export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams
): Promise<SendEmailResult> {
  pruneCompletedDeliveries();

  const idempotencyKey = params.idempotencyKey?.trim() || '';
  if (idempotencyKey) {
    if (inFlightIdempotencyKeys.has(idempotencyKey)) {
      return {
        ok: false,
        provider: 'none',
        errorCode: 'DUPLICATE_DELIVERY_PREVENTED',
        errorMessage: 'An identical email delivery request is already in progress. Duplicate dispatch blocked.',
        fallbackUsed: false,
        fallbackFromProvider: null,
        attempts: []
      };
    }
    const prior = completedDeliveries.get(idempotencyKey);
    if (prior) {
      return {
        ok: false,
        provider: prior.provider,
        errorCode: 'DUPLICATE_DELIVERY_PREVENTED',
        errorMessage: `Email already delivered via ${prior.provider} (Message ID ${prior.messageId}). Duplicate send prevented.`,
        fallbackUsed: false,
        fallbackFromProvider: null,
        attempts: []
      };
    }
    inFlightIdempotencyKeys.add(idempotencyKey);
  }

  try {
    const primaryProvider: EmailProviderName =
      params.explicitProvider && isValidProviderName(params.explicitProvider)
        ? params.explicitProvider
        : params.policy?.activeProvider && isValidProviderName(params.policy.activeProvider)
        ? params.policy.activeProvider
        : DEFAULT_EMAIL_PROVIDER;

    const allowFallback = Boolean(params.policy?.allowFallback) && !params.explicitProvider;
    const fallbackProvider: EmailProviderName | null =
      allowFallback &&
      isValidProviderName(params.policy?.fallbackProvider) &&
      params.policy?.fallbackProvider !== primaryProvider
        ? params.policy!.fallbackProvider!
        : null;

    const attempts: DispatchAttemptRecord[] = [];
    const primaryResult = await executeSingleProvider(primaryProvider, params, idempotencyKey || undefined);

    attempts.push({
      attemptAt: primaryResult.attemptAt,
      provider: primaryResult.provider,
      status: primaryResult.status,
      messageId: primaryResult.messageId,
      senderEmail: primaryResult.senderEmail,
      errorCode: primaryResult.errorCode,
      errorMessage: primaryResult.errorMessage
    });

    if (primaryResult.ok && primaryResult.messageId && primaryResult.senderEmail) {
      if (idempotencyKey) {
        completedDeliveries.set(idempotencyKey, {
          messageId: primaryResult.messageId,
          provider: primaryProvider,
          completedAtMs: Date.now()
        });
      }
      return {
        ok: true,
        provider: primaryProvider,
        messageId: primaryResult.messageId,
        senderEmail: primaryResult.senderEmail,
        acceptedAt: primaryResult.attemptAt,
        deliveryNote: primaryResult.deliveryNote || `Accepted by ${primaryProvider}.`,
        fallbackUsed: false,
        fallbackFromProvider: null,
        attempts
      };
    }

    // Do NOT silently switch providers unless administrator explicitly enabled fallback
    if (allowFallback && fallbackProvider) {
      const fallbackKey = idempotencyKey ? `${idempotencyKey}:fallback` : undefined;
      const fallbackResult = await executeSingleProvider(fallbackProvider, params, fallbackKey);

      attempts.push({
        attemptAt: fallbackResult.attemptAt,
        provider: fallbackResult.provider,
        status: fallbackResult.status,
        messageId: fallbackResult.messageId,
        senderEmail: fallbackResult.senderEmail,
        errorCode: fallbackResult.errorCode,
        errorMessage: fallbackResult.errorMessage
      });

      if (fallbackResult.ok && fallbackResult.messageId && fallbackResult.senderEmail) {
        if (idempotencyKey) {
          completedDeliveries.set(idempotencyKey, {
            messageId: fallbackResult.messageId,
            provider: fallbackProvider,
            completedAtMs: Date.now()
          });
        }
        return {
          ok: true,
          provider: fallbackProvider,
          messageId: fallbackResult.messageId,
          senderEmail: fallbackResult.senderEmail,
          acceptedAt: fallbackResult.attemptAt,
          deliveryNote: `${fallbackResult.deliveryNote || `Accepted by ${fallbackProvider}.`} (Explicit fallback after ${primaryProvider} failed: ${primaryResult.errorMessage})`,
          fallbackUsed: true,
          fallbackFromProvider: primaryProvider,
          attempts
        };
      }

      return {
        ok: false,
        provider: fallbackProvider,
        errorCode: fallbackResult.errorCode || 'PROVIDER_REJECTED',
        errorMessage: `Primary (${primaryProvider}) failed: ${primaryResult.errorMessage} | Fallback (${fallbackProvider}) failed: ${fallbackResult.errorMessage}`,
        fallbackUsed: true,
        fallbackFromProvider: primaryProvider,
        attempts
      };
    }

    return {
      ok: false,
      provider: primaryProvider,
      errorCode: primaryResult.errorCode || 'PROVIDER_REJECTED',
      errorMessage: primaryResult.errorMessage || `Email delivery failed on ${primaryProvider}.`,
      fallbackUsed: false,
      fallbackFromProvider: null,
      attempts
    };
  } finally {
    if (idempotencyKey) {
      inFlightIdempotencyKeys.delete(idempotencyKey);
    }
  }
}
