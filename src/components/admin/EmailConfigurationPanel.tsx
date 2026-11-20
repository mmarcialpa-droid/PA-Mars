import React, { useCallback, useEffect, useState } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  KeyRound,
  Save,
  Server,
  Clock,
  RotateCcw,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  EmailDeliveryLog,
  EmailProviderId,
  EmailProviderStatus
} from '../../types';
import {
  emailConfigService,
  EmailServiceApiError
} from '../../services/email/emailConfigService';
import {
  authorizeGmailSender,
  clearGmailSession,
  GmailSenderSession,
  subscribeGmailSession
} from '../../services/gmail/gmailOAuthService';

const PROVIDER_LABELS: Record<EmailProviderId, string> = {
  resend: 'Resend API (Default)',
  gmail_oauth: 'Gmail OAuth 2.0',
  smtp: 'Custom SMTP'
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export const EmailConfigurationPanel: React.FC = () => {
  const {
    organization,
    currentUser,
    isSuperAdmin,
    isAdmin,
    resendInvitation,
    showToast
  } = useApp();

  const [status, setStatus] = useState<EmailProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [gmailSession, setGmailSession] = useState<GmailSenderSession | null>(null);
  const [authorizingGmail, setAuthorizingGmail] = useState(false);

  // Editable provider policy form state
  const [selectedProvider, setSelectedProvider] = useState<EmailProviderId>('resend');
  const [allowFallback, setAllowFallback] = useState(false);
  const [fallbackProvider, setFallbackProvider] = useState<EmailProviderId | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);

  // Test email form state
  const [testRecipient, setTestRecipient] = useState(currentUser?.email || '');
  const [testNote, setTestNote] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResultBanner, setTestResultBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Logs filter & retry tracking
  const [logFilter, setLogFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeGmailSession(setGmailSession);
    return unsub;
  }, []);

  useEffect(() => {
    if (currentUser?.email && !testRecipient) {
      setTestRecipient(currentUser.email);
    }
  }, [currentUser?.email, testRecipient]);

  const loadStatus = useCallback(async (tokenOverride?: string | null) => {
    if (!organization?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const token = tokenOverride !== undefined ? tokenOverride : gmailSession?.accessToken || null;
      const snapshot = await emailConfigService.getStatus(organization.id, token);
      setStatus(snapshot);
      setSelectedProvider(snapshot.activeProvider || 'resend');
      setAllowFallback(Boolean(snapshot.allowFallback));
      setFallbackProvider(snapshot.fallbackProvider || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load email configuration.';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, gmailSession?.accessToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">Administrator Access Required</h3>
        <p className="text-xs text-slate-500">
          Only organization Administrators or the Super Administrator can configure transactional email providers and inspect delivery logs.
        </p>
      </div>
    );
  }

  const handleSaveProviderConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    setSavingConfig(true);
    setConfigNotice(null);
    try {
      const nextFallback =
        allowFallback && fallbackProvider && fallbackProvider !== selectedProvider
          ? fallbackProvider
          : null;

      const updated = await emailConfigService.updateConfig(
        organization.id,
        {
          activeProvider: selectedProvider,
          allowFallback: Boolean(allowFallback && nextFallback),
          fallbackProvider: nextFallback
        },
        gmailSession?.accessToken || null
      );

      setStatus((prev) => ({
        ...updated,
        logs: prev?.logs || []
      }));
      if (updated.configurationWarning) {
        setConfigNotice(updated.configurationWarning);
        showToast('info', `Saved active provider (${PROVIDER_LABELS[selectedProvider]}), pending server configuration.`);
      } else {
        showToast('success', `Active email provider set to ${PROVIDER_LABELS[selectedProvider]}.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save provider settings.';
      showToast('error', msg);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAuthorizeGmail = async (forceConsent = false) => {
    setAuthorizingGmail(true);
    try {
      const session = await authorizeGmailSender({ forceConsent });
      showToast('success', `Gmail OAuth authorized for ${session.senderEmail}.`);
      await loadStatus(session.accessToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gmail authorization failed.';
      showToast('error', msg);
    } finally {
      setAuthorizingGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    clearGmailSession();
    showToast('info', 'Disconnected Gmail OAuth session.');
    await loadStatus(null);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !testRecipient.trim()) return;
    setSendingTest(true);
    setTestResultBanner(null);
    try {
      const res = await emailConfigService.sendTestEmail(
        organization.id,
        {
          recipientEmail: testRecipient.trim(),
          note: testNote.trim() || undefined
        },
        gmailSession?.accessToken || null
      );
      setTestResultBanner({
        type: 'success',
        message: `${res.deliveryNote || `Accepted by ${res.provider} for ${testRecipient.trim()}`}`
      });
      showToast('success', `Test email accepted by ${res.provider}.`);
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test email delivery failed.';
      setTestResultBanner({
        type: 'error',
        message: msg
      });
      showToast('error', msg);
      await loadStatus();
    } finally {
      setSendingTest(false);
    }
  };

  const handleRetryLog = async (log: EmailDeliveryLog) => {
    if (!organization?.id) return;
    setRetryingLogId(log.id);
    try {
      if (log.category === 'invitation' && log.relatedInvitationId) {
        await resendInvitation(log.relatedInvitationId);
      } else {
        await emailConfigService.retryFailedLog(
          organization.id,
          log.id,
          gmailSession?.accessToken || null
        );
        showToast('success', `Retry email sent to ${log.recipientEmail}.`);
      }
      await loadStatus();
    } catch (err: unknown) {
      if (
        err instanceof EmailServiceApiError &&
        err.errorCode === 'USE_INVITATION_RESEND' &&
        err.relatedInvitationId
      ) {
        try {
          await resendInvitation(err.relatedInvitationId);
          await loadStatus();
          return;
        } catch (resendErr: unknown) {
          const msg = resendErr instanceof Error ? resendErr.message : 'Failed to retry invitation.';
          showToast('error', msg);
          return;
        }
      }
      const msg = err instanceof Error ? err.message : 'Retry delivery failed.';
      showToast('error', msg);
      await loadStatus();
    } finally {
      setRetryingLogId(null);
    }
  };

  const activeProvider: EmailProviderId = status?.activeProvider || 'resend';
  const activeDiag = status?.providers?.[activeProvider];
  const selectedDiag = status?.providers?.[selectedProvider];
  const config = status?.config;
  const logs = status?.logs || [];
  const filteredLogs = logs.filter((entry) =>
    logFilter === 'all' ? true : entry.status === logFilter
  );

  const availableFallbackOptions: EmailProviderId[] = (
    ['resend', 'gmail_oauth', 'smtp'] as EmailProviderId[]
  ).filter((p) => p !== selectedProvider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-700" />
            <span>Email Configuration & Delivery Diagnostics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized transactional email routing for system invitations and notifications. Only environment variables for your selected provider are required.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadStatus()}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {loadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Telemetry Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Email Provider
          </span>
          <p className="text-sm font-bold text-slate-900">
            {PROVIDER_LABELS[activeProvider]}
          </p>
          <p className="text-[11px] text-slate-500">
            {status?.allowFallback && status.fallbackProvider
              ? `Explicit fallback: ${PROVIDER_LABELS[status.fallbackProvider]}`
              : 'Strict mode (no silent fallback)'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Provider Connection Status
          </span>
          <div className="flex items-center gap-1.5">
            {status?.activeProviderConfigured ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-bold text-emerald-700">Connected & Ready</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-sm font-bold text-amber-800">Action Required</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            {activeDiag?.statusMessage || 'Checking provider configuration...'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Sender Address
          </span>
          <p className="text-sm font-bold text-slate-900 font-mono truncate">
            {status?.activeSenderAddress || 'Not configured'}
          </p>
          <p className="text-[11px] text-slate-500">
            {activeProvider === 'gmail_oauth'
              ? 'From authorized Google Workspace account'
              : activeProvider === 'resend'
              ? 'Configured via RESEND_FROM'
              : 'Configured via SMTP_FROM'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1 sm:col-span-1 lg:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Last Successful Delivery
          </span>
          <p className="text-xs font-bold text-slate-900">
            {config?.lastSuccessfulDeliveryAt
              ? formatDateTime(config.lastSuccessfulDeliveryAt)
              : 'No deliveries yet'}
          </p>
          {config?.lastSuccessfulSender && (
            <p className="text-[11px] text-slate-500 truncate">
              Via {config.lastSuccessfulProvider} ({config.lastSuccessfulSender})
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1 sm:col-span-1 lg:col-span-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Last Delivery Error
          </span>
          {config?.lastErrorMessage ? (
            <>
              <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-xs">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {config.lastErrorProvider || 'Provider'} · {formatDateTime(config.lastErrorAt)}
                </span>
              </div>
              <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 leading-relaxed">
                {config.lastErrorMessage}
              </p>
            </>
          ) : (
            <p className="text-xs font-medium text-slate-500">No delivery errors recorded.</p>
          )}
        </div>
      </div>

      {/* Active Provider Selection & Environment Requirements */}
      <form
        onSubmit={handleSaveProviderConfig}
        className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-700" />
              <span>Select Active Email Provider</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Resend is the default automated email provider. Environment variables for inactive providers are never required.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['resend', 'gmail_oauth', 'smtp'] as EmailProviderId[]).map((providerId) => {
            const diag = status?.providers?.[providerId];
            const isSelected = selectedProvider === providerId;
            return (
              <label
                key={providerId}
                className={`cursor-pointer border rounded-xl p-4 transition-all flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'border-slate-900 bg-slate-50/70 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="activeProvider"
                      value={providerId}
                      checked={isSelected}
                      onChange={() => {
                        setSelectedProvider(providerId);
                        if (fallbackProvider === providerId) {
                          setFallbackProvider(null);
                        }
                      }}
                      className="text-slate-900 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-slate-900">
                      {PROVIDER_LABELS[providerId]}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      diag?.configured
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isSelected
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {diag?.configured ? 'Ready' : isSelected ? 'Setup Needed' : 'Inactive'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {diag?.description ||
                    (providerId === 'resend'
                      ? 'Default transactional email delivery via Resend API.'
                      : providerId === 'gmail_oauth'
                      ? 'Separate Gmail API delivery with user-authorized gmail.send scope.'
                      : 'Optional authenticated SMTP relay.')}
                </p>

                <div className="pt-1 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                  {providerId === 'gmail_oauth'
                    ? 'OAuth: gmail.send (No SMTP/API secrets)'
                    : `Required: ${(diag?.requiredEnvVars || []).join(', ')}`}
                </div>
              </label>
            );
          })}
        </div>

        {/* Selected provider validation banner — ONLY validates the selected provider */}
        {selectedDiag && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              selectedDiag.configured
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {selectedDiag.configured ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">
                {selectedDiag.label} — {selectedDiag.configured ? 'Configured' : 'Configuration Required'}
              </p>
              <p className="text-[11px] leading-relaxed">{selectedDiag.statusMessage}</p>
              {!selectedDiag.configured && selectedDiag.missingEnvVars.length > 0 && (
                <p className="text-[11px] font-mono">
                  Set server secrets in AI Studio Secrets / environment: {selectedDiag.missingEnvVars.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {configNotice && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs">
            {configNotice}
          </div>
        )}

        {/* Explicit Fallback Policy */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3 text-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-slate-900">Explicit Fallback Policy</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                MARS never silently switches email providers on error. Enable fallback only if you want failed sends retried automatically on a chosen secondary provider.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={allowFallback}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAllowFallback(next);
                  if (next && (!fallbackProvider || fallbackProvider === selectedProvider)) {
                    setFallbackProvider(availableFallbackOptions[0] || null);
                  }
                }}
                className="rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <span>Enable Fallback</span>
            </label>
          </div>

          {allowFallback && (
            <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="font-semibold text-slate-700 shrink-0">
                Secondary Fallback Provider:
              </label>
              <select
                value={fallbackProvider || ''}
                onChange={(e) =>
                  setFallbackProvider((e.target.value || null) as EmailProviderId | null)
                }
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="">Select fallback provider...</option>
                {availableFallbackOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {PROVIDER_LABELS[opt]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={savingConfig}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savingConfig ? 'Saving Configuration...' : 'Save Email Provider Settings'}</span>
          </button>
        </div>
      </form>

      {/* Separate Gmail OAuth Integration + Test Email Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Separate Gmail OAuth 2.0 Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  gmailSession
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {gmailSession ? <ShieldCheck className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Gmail OAuth 2.0 Integration (Separate)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  One-time Google Workspace authorization with <code className="font-mono">gmail.send</code> permission. Uses OAuth tokens directly — never SMTP passwords.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1">
            {gmailSession ? (
              <>
                <p className="font-semibold text-emerald-700">
                  Authorized Sender: <span className="font-mono">{gmailSession.senderEmail}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  In-memory OAuth session active until{' '}
                  {new Date(gmailSession.expiresAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}{' '}
                  — shared automatically across invitations and test sends without re-prompting per email.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-slate-600">
                No Gmail OAuth session active right now. Authorize once per session when using Gmail OAuth as your active or fallback sender.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {gmailSession ? (
              <>
                <button
                  type="button"
                  onClick={() => handleAuthorizeGmail(false)}
                  disabled={authorizingGmail}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  {authorizingGmail ? 'Refreshing...' : 'Refresh Gmail Session'}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectGmail}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleAuthorizeGmail(true)}
                disabled={authorizingGmail}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                {authorizingGmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing Gmail...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Authorize Gmail Sender</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Test Email Function */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3.5">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-slate-700" />
              <span>Test Email Delivery</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dispatches a real transactional test message through <strong>{PROVIDER_LABELS[activeProvider]}</strong> and logs the provider response.
            </p>
          </div>

          <form onSubmit={handleSendTestEmail} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Recipient Email Address
              </label>
              <input
                type="email"
                required
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="admin@company.com"
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Diagnostic Note (Optional)
              </label>
              <input
                type="text"
                value={testNote}
                onChange={(e) => setTestNote(e.target.value)}
                placeholder="Production Resend verification"
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {testResultBanner && (
              <div
                className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                  testResultBanner.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResultBanner.message}
              </div>
            )}

            <button
              type="submit"
              disabled={sendingTest || !testRecipient.trim()}
              className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5"
            >
              {sendingTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending Real Test Email...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email via {PROVIDER_LABELS[activeProvider]}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Email Delivery Logs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              <span>Email Delivery Logs ({filteredLogs.length})</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Audit history of real transactional email attempts, provider receipts, and retries.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
            {(['all', 'sent', 'failed'] as const).map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setLogFilter(filterKey)}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                  logFilter === filterKey
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filterKey}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No email delivery logs recorded for this filter yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((entry) => {
              const canRetry = entry.status === 'failed' && !entry.retriedByLogId;
              const isRetrying = retryingLogId === entry.id;

              return (
                <div key={entry.id} className="p-4 text-xs hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            entry.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {entry.status === 'sent' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span className="uppercase">{entry.status}</span>
                        </span>

                        <span className="font-bold text-slate-900 truncate">
                          {entry.recipientEmail}
                        </span>

                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                          {entry.category}
                        </span>

                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          {entry.provider}
                        </span>

                        {entry.fallbackUsed && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Fallback from {entry.fallbackFromProvider}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-700 truncate">{entry.subject}</p>

                      <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-2 font-mono">
                        <span>{formatDateTime(entry.createdAt)}</span>
                        {entry.senderEmail && <span>· From: {entry.senderEmail}</span>}
                        {entry.messageId && <span>· ID: {entry.messageId}</span>}
                        {entry.retriedByLogId && (
                          <span className="text-emerald-700">· Retried</span>
                        )}
                      </div>

                      {entry.status === 'failed' && entry.errorMessage && (
                        <p className="text-[11px] text-rose-700 bg-rose-50/80 border border-rose-200/80 rounded px-2 py-1 mt-1">
                          {entry.errorMessage}
                        </p>
                      )}
                    </div>

                    {canRetry && (
                      <button
                        type="button"
                        onClick={() => handleRetryLog(entry)}
                        disabled={isRetrying}
                        className="self-start md:self-center shrink-0 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
                      >
                        {isRetrying ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        <span>{isRetrying ? 'Retrying...' : 'Retry Send'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
