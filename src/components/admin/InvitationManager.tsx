import React, { useEffect, useState } from 'react';
import {
  Mail,
  Plus,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  Send,
  RefreshCw,
  Ban,
  ChevronDown,
  ChevronUp,
  KeyRound,
  ShieldCheck,
  Loader2,
  Settings,
  Copy,
  Link2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmailProviderStatus, Invitation } from '../../types';
import { InvitationApiError, userService } from '../../services/users/userService';
import { subscribeGmailSession, GmailSenderSession } from '../../services/gmail/gmailOAuthService';

function getDisplayStatus(inv: Invitation) {
  const isExpired =
    inv.status !== 'accepted' &&
    inv.status !== 'revoked' &&
    new Date(inv.expiresAt).getTime() < Date.now();
  return isExpired ? 'expired' : inv.status;
}

interface GeneratedInviteShare {
  email: string;
  invitationCode: string;
  registrationUrl: string;
  emailDelivered: boolean;
}

export const InvitationManager: React.FC = () => {
  const {
    organization,
    invitations,
    inviteEmployee,
    resendInvitation,
    revokeInvitation,
    departments,
    positions,
    roles,
    isSuperAdmin,
    isAdmin,
    openEmailConfiguration,
    showToast
  } = useApp();

  const [emailStatus, setEmailStatus] = useState<EmailProviderStatus | null>(null);
  const [gmailSession, setGmailSession] = useState<GmailSenderSession | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [positionId, setPositionId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(['role_member']);
  const [expirationDays, setExpirationDays] = useState<number>(7);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateExistingId, setDuplicateExistingId] = useState<string | null>(null);

  const [generatedShare, setGeneratedShare] = useState<GeneratedInviteShare | null>(null);
  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = subscribeGmailSession(setGmailSession);
    return unsub;
  }, []);

  useEffect(() => {
    userService
      .getEmailProviderStatus(organization?.id, gmailSession?.accessToken || null)
      .then(setEmailStatus)
      .catch(() => null);
  }, [organization?.id, gmailSession?.accessToken]);

  useEffect(() => {
    const activeKeys = Object.keys(cooldowns).filter((k) => cooldowns[k] > Date.now());
    if (activeKeys.length === 0) return;
    const timer = window.setInterval(() => {
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [k, until] of Object.entries(prev)) {
          if (until > Date.now()) {
            next[k] = until;
          } else {
            changed = true;
          }
        }
        return changed ? next : { ...prev };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldowns]);

  const hasReadySender = Boolean(
    emailStatus?.activeProviderConfigured ||
      (emailStatus?.activeProvider === 'gmail_oauth' && gmailSession)
  );

  const handleCopy = async (value: string, field: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      showToast('success', field === 'code' ? 'Invitation code copied.' : 'Registration link copied.');
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast('error', 'Unable to copy to clipboard.');
    }
  };

  const handleOpenModal = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setDepartmentId(departments[0]?.id || null);
    setPositionId(positions[0]?.id || null);
    setSelectedRoleIds(['role_member']);
    setExpirationDays(7);
    setError(null);
    setDuplicateExistingId(null);
    setIsModalOpen(true);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setDuplicateExistingId(null);
    try {
      const res = await inviteEmployee({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        departmentId: departmentId || null,
        positionId: positionId || null,
        roleIds: selectedRoleIds,
        expirationDays
      });
      if (res.invitationCode && res.registrationUrl) {
        setGeneratedShare({
          email: res.invitation.email,
          invitationCode: res.invitationCode,
          registrationUrl: res.registrationUrl,
          emailDelivered: res.emailDelivered
        });
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      if (err instanceof InvitationApiError && err.existingInvitationId) {
        setDuplicateExistingId(err.existingInvitationId);
      }
      const msg = err instanceof Error ? err.message : 'Could not generate invitation code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateCode = async (invitationId: string) => {
    setResendingId(invitationId);
    setError(null);
    try {
      const res = await resendInvitation(invitationId);
      setCooldowns((prev) => ({ ...prev, [invitationId]: Date.now() + 45_000 }));
      if (res.invitationCode && res.registrationUrl) {
        setGeneratedShare({
          email: res.invitation.email,
          invitationCode: res.invitationCode,
          registrationUrl: res.registrationUrl,
          emailDelivered: res.emailDelivered
        });
      }
      setIsModalOpen(false);
      setDuplicateExistingId(null);
    } catch (err: unknown) {
      if (err instanceof InvitationApiError && err.retryAfterSeconds) {
        setCooldowns((prev) => ({
          ...prev,
          [invitationId]: Date.now() + err.retryAfterSeconds! * 1000
        }));
      }
      const msg = err instanceof Error ? err.message : 'Failed to regenerate invitation code.';
      showToast('error', msg);
      if (isModalOpen) setError(msg);
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    try {
      await revokeInvitation(invitationId);
      setConfirmRevokeId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke invitation.';
      showToast('error', msg);
    } finally {
      setRevokingId(null);
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    if (selectedRoleIds.includes(roleId)) {
      if (selectedRoleIds.length === 1) return;
      setSelectedRoleIds((prev) => prev.filter((r) => r !== roleId));
    } else {
      setSelectedRoleIds((prev) => [...prev, roleId]);
    }
  };

  const renderStatusBadge = (inv: Invitation) => {
    const status = getDisplayStatus(inv);
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3 h-3" />
            <span>Accepted</span>
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
            <Send className="w-3 h-3" />
            <span>Email Sent</span>
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
            <AlertCircle className="w-3 h-3" />
            <span>Email Failed</span>
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <Ban className="w-3 h-3" />
            <span>Revoked</span>
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <XCircle className="w-3 h-3" />
            <span>Expired</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <Clock className="w-3 h-3" />
            <span>Ready to Share</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Team Invitations ({invitations.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate one-time invitation codes and registration links for employees—no external email provider required.
          </p>
        </div>

        {(isSuperAdmin || isAdmin) && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Invitation Code</span>
          </button>
        )}
      </div>

      {/* Shareable Newly Generated Code Banner */}
      {generatedShare && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-950">
                  Invitation Code Ready for {generatedShare.email}
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  {generatedShare.emailDelivered
                    ? 'The invitation was emailed and is also available below for direct sharing.'
                    : 'Copy and share this one-time invitation code or direct signup link with your team member. This full code is displayed once for security.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGeneratedShare(null)}
              className="text-emerald-700 hover:text-emerald-950"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="bg-white border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Invitation Code
                </span>
                <span className="font-mono-tabular font-bold text-slate-900 truncate block">
                  {generatedShare.invitationCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(generatedShare.invitationCode, 'code')}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 shrink-0"
              >
                {copiedField === 'code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'code' ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="bg-white border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Direct Registration Link
                </span>
                <span className="font-mono text-[11px] text-slate-700 truncate block">
                  {generatedShare.registrationUrl}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(generatedShare.registrationUrl, 'link')}
                className="px-2.5 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-md text-[11px] font-semibold flex items-center gap-1 shrink-0"
              >
                {copiedField === 'link' ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                <span>{copiedField === 'link' ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Code Generation Status Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200">
            {hasReadySender ? <ShieldCheck className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
          </div>
          <div className="text-xs">
            <p className="font-bold text-slate-900">
              In-App Invitation Code Generation Active
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              {hasReadySender
                ? 'Generated codes are displayed immediately for copying and also dispatched via your optional email provider.'
                : 'Invitation codes and direct registration links are generated instantly in MARS for direct sharing. No external email service is required.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openEmailConfiguration}
          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 self-start sm:self-auto"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Optional Email Settings</span>
        </button>
      </div>

      {/* Invitations List */}
      {invitations.length === 0 ? (
        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
          <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No invitations created yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create an invitation code for a team member to pre-assign their department, position, and system roles.
          </p>
          <button
            onClick={handleOpenModal}
            className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Create First Invitation
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="divide-y divide-slate-100">
            {invitations
              .filter((inv): inv is Invitation => Boolean(inv && inv.id))
              .map((inv) => {
                const dept = departments.find((d) => d.id === inv.departmentId);
                const pos = positions.find((p) => p.id === inv.positionId);
                const invRoles = roles.filter((r) => (inv.roleIds || []).includes(r.id));
                const displayStatus = getDisplayStatus(inv);
                const cooldownUntil = cooldowns[inv.id] || 0;
                const cooldownRemaining = Math.max(
                  0,
                  Math.ceil((cooldownUntil - Date.now()) / 1000)
                );
                const canRegenerate = displayStatus !== 'accepted' && displayStatus !== 'revoked';
                const attempts = Array.isArray(inv.sendAttempts) ? inv.sendAttempts : [];
                const isHistoryOpen = expandedHistoryId === inv.id;

                return (
                  <div key={inv.id} className="p-4 text-xs hover:bg-slate-50/60 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">{inv.email}</span>
                          {(inv.firstName || inv.lastName) && (
                            <span className="text-[11px] text-slate-500">
                              ({`${inv.firstName || ''} ${inv.lastName || ''}`.trim()})
                            </span>
                          )}
                          <span className="text-slate-300">·</span>
                          {renderStatusBadge(inv)}
                          {inv.codeMask && (
                            <span className="font-mono-tabular text-[11px] text-slate-500">
                              · {inv.codeMask}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                          <span>{dept?.name || 'Unassigned Dept'}</span>
                          <span>·</span>
                          <span>{pos?.title || 'Unassigned Position'}</span>
                          <span>·</span>
                          <span>
                            Roles:{' '}
                            {invRoles.length > 0
                              ? invRoles.map((r) => r.name).join(', ')
                              : inv.roleIds.join(', ')}
                          </span>
                          <span>·</span>
                          <span className="font-mono-tabular text-slate-400">
                            Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </span>
                          {(inv.resendCount || 0) > 0 && (
                            <>
                              <span>·</span>
                              <span className="font-mono-tabular text-slate-500">
                                Rotated {inv.resendCount}x
                              </span>
                            </>
                          )}
                        </div>

                        {inv.deliveryNote && inv.status !== 'accepted' && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{inv.deliveryNote}</p>
                        )}

                        {inv.status === 'failed' && inv.deliveryError && (
                          <p className="text-[11px] text-rose-700 mt-0.5">{inv.deliveryError}</p>
                        )}

                        {inv.status === 'accepted' && inv.redeemedAt && (
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Redeemed by {inv.redeemedEmail || inv.email} on{' '}
                            {new Date(inv.redeemedAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {attempts.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistoryId(isHistoryOpen ? null : inv.id)
                            }
                            className="px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-md text-[11px] font-medium flex items-center gap-1"
                          >
                            <span>Log ({attempts.length})</span>
                            {isHistoryOpen ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        )}

                        {canRegenerate && (
                          <button
                            type="button"
                            disabled={resendingId === inv.id || cooldownRemaining > 0}
                            onClick={() => handleRegenerateCode(inv.id)}
                            className="px-2.5 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-colors bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-50"
                            title="Generate a fresh invitation code to share"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${
                                resendingId === inv.id ? 'animate-spin' : ''
                              }`}
                            />
                            <span>
                              {resendingId === inv.id
                                ? 'Generating...'
                                : cooldownRemaining > 0
                                ? `Wait ${cooldownRemaining}s`
                                : 'Regenerate Code'}
                            </span>
                          </button>
                        )}

                        {canRegenerate && (
                          confirmRevokeId === inv.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={revokingId === inv.id}
                                onClick={() => handleRevoke(inv.id)}
                                className="px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-semibold"
                              >
                                {revokingId === inv.id ? 'Revoking...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeId(null)}
                                className="px-2 py-1.5 border border-slate-200 text-slate-600 rounded-md text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRevokeId(inv.id)}
                              className="px-2.5 py-1.5 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-md text-xs font-medium transition-colors"
                            >
                              Revoke
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {isHistoryOpen && attempts.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Delivery Attempt History
                        </p>
                        <div className="space-y-1">
                          {attempts.map((att, idx) => (
                            <div
                              key={`${att.attemptAt}_${idx}`}
                              className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 border border-slate-200/70 rounded px-2.5 py-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-semibold ${
                                    att.status === 'sent' ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {att.status === 'sent' ? 'Dispatched' : 'Not Delivered'}
                                </span>
                                <span className="text-slate-500 uppercase text-[10px]">
                                  {att.provider}
                                </span>
                                {att.messageId && (
                                  <span className="font-mono-tabular text-slate-500">
                                    ID: {att.messageId}
                                  </span>
                                )}
                                {att.errorMessage && (
                                  <span className="text-slate-600">{att.errorMessage}</span>
                                )}
                              </div>
                              <span className="font-mono-tabular text-slate-400">
                                {new Date(att.attemptAt).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Invitation Code</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 leading-relaxed">
              Generates a one-time invitation code and registration URL immediately for you to copy and share with your coworker.
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {duplicateExistingId && (
                  <button
                    type="button"
                    disabled={resendingId === duplicateExistingId}
                    onClick={() => handleRegenerateCode(duplicateExistingId)}
                    className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold text-[11px]"
                  >
                    {resendingId === duplicateExistingId
                      ? 'Generating...'
                      : 'Regenerate Existing Invitation Code'}
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Invitee Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com or colleague@gmail.com"
                  required
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={departmentId || ''}
                    onChange={(e) => setDepartmentId(e.target.value ? e.target.value : null)}
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Position
                  </label>
                  <select
                    value={positionId || ''}
                    onChange={(e) => setPositionId(e.target.value ? e.target.value : null)}
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">Unassigned</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (L{p.level})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Code Validity Window
                </label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value={3}>3 days</option>
                  <option value={7}>7 days (Recommended)</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Initial Roles
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const isSelected = selectedRoleIds.includes(r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => toggleRoleSelection(r.id)}
                        className={`p-2 rounded-lg border text-left transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-semibold truncate">{r.name}</span>
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{loading ? 'Generating...' : 'Generate Invitation Code'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
