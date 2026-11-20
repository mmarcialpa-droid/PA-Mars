import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, UserPlus, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RegistrationPolicy } from '../../types';

const POLICY_OPTIONS: {
  id: RegistrationPolicy;
  title: string;
  badge: string;
  description: string;
}[] = [
  {
    id: 'invitation_only',
    title: 'Invitation Only (Recommended)',
    badge: 'Default',
    description:
      'New members must enter a valid administrator invitation code before registering with their Email & Password.'
  },
  {
    id: 'admin_created',
    title: 'Administrator-Created Accounts',
    badge: 'Strict',
    description:
      'Self-registration is closed. Only Super Administrators or Administrators can provision new team accounts in Admin Hub.'
  },
  {
    id: 'public_registration',
    title: 'Open Public Registration',
    badge: 'Open',
    description:
      'Anyone can create a Member account using Email & Password. Role and department assignment remain admin-controlled.'
  }
];

export const AuthPolicyPanel: React.FC = () => {
  const { authPolicy, updateAuthPolicy, isSuperAdmin, isAdmin, showToast } = useApp();

  const [registrationPolicy, setRegistrationPolicy] = useState<RegistrationPolicy>(
    authPolicy.registrationPolicy || 'invitation_only'
  );
  const [requireAdminApproval, setRequireAdminApproval] = useState<boolean>(
    authPolicy.requireAdminApproval ?? true
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRegistrationPolicy(authPolicy.registrationPolicy || 'invitation_only');
    setRequireAdminApproval(authPolicy.requireAdminApproval ?? true);
  }, [authPolicy]);

  const canEdit = isSuperAdmin || isAdmin;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setError(null);
    setSavedNotice(false);
    try {
      await updateAuthPolicy({
        registrationPolicy,
        requireEmailVerification: false,
        requireAdminApproval
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save authentication policy.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Authentication &amp; Registration Policy
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All users authenticate directly via Email &amp; Password without external email dependencies. Control how new team members join this workspace.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Email &amp; Password Auth</span>
        </span>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 text-xs">
        <div className="space-y-2.5">
          <label className="block font-bold text-slate-800">Registration Mode</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {POLICY_OPTIONS.map((opt) => {
              const selected = registrationPolicy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!canEdit || saving}
                  onClick={() => setRegistrationPolicy(opt.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all space-y-1.5 ${
                    selected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50/70 text-slate-800 border-slate-200 hover:bg-slate-100/80'
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs">{opt.title}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        selected ? 'bg-slate-800 text-emerald-300' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-1">
          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 ${
              registrationPolicy === 'public_registration' ? 'cursor-pointer' : 'opacity-60'
            }`}
          >
            <input
              type="checkbox"
              disabled={!canEdit || saving || registrationPolicy !== 'public_registration'}
              checked={requireAdminApproval}
              onChange={(e) => setRequireAdminApproval(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-slate-600" />
                <span>Require Administrator Approval (Open Registration)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                When Open Public Registration is enabled, new self-registered accounts stay in{' '}
                <code className="font-mono">pending_approval</code> until an administrator approves them in Registration Requests.
              </p>
            </div>
          </label>
        </div>

        {canEdit && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            {savedNotice ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Authentication policy updated in Firestore.</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Changes take effect immediately on the Log In &amp; Sign Up screens.
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{saving ? 'Saving Policy...' : 'Save Authentication Policy'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
