import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  BadgeInfo,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface LoginPageProps {
  onNavigateToRegister: () => void;
  onNavigateToSetup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateToRegister,
  onNavigateToSetup
}) => {
  const { signInWithEmail, submitPasswordRecoveryRequest, systemConfig, authPolicy } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Administrator-Assisted Password Recovery modal state
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryEmployeeId, setRecoveryEmployeeId] = useState('');
  const [recoveryNote, setRecoveryNote] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(trimmedEmail, password, rememberMe);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecoveryModal = () => {
    setRecoveryEmail(email.trim());
    setRecoveryEmployeeId('');
    setRecoveryNote('');
    setRecoveryError(null);
    setRecoverySuccess(false);
    setIsRecoveryModalOpen(true);
  };

  const handleSubmitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    const trimmedEmail = recoveryEmail.trim();
    if (!trimmedEmail) {
      setRecoveryError('Please enter the email address associated with your MARS account.');
      return;
    }

    setRecoveryLoading(true);
    try {
      await submitPasswordRecoveryRequest({
        email: trimmedEmail,
        employeeId: recoveryEmployeeId.trim() || null,
        note: recoveryNote.trim() || null
      });
      setRecoverySuccess(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not submit your password recovery request. Please contact your workspace administrator.';
      setRecoveryError(msg);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const canShowCreateAccount = authPolicy.registrationPolicy !== 'admin_created';

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-slate-50 text-slate-800 px-4 py-8">
      {/* Brand & Workspace Header */}
      <div className="w-full max-w-md mx-auto text-center mb-7">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white font-bold text-xl shadow-sm mb-3">
          M
        </div>
        <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
          {authPolicy.organizationName || 'MARS'}
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Project-Centered Management &amp; Team Collaboration
        </p>

        {!systemConfig.initialized && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs flex items-start gap-2.5 text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Workspace Setup Required</p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                System configuration has not been launched yet. The Super Administrator can set up or resume organization configuration.
              </p>
              <button
                type="button"
                onClick={onNavigateToSetup}
                className="mt-2 text-xs font-semibold text-amber-950 underline hover:no-underline"
              >
                Open Organization Setup Dashboard &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Auth Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-7">
        {/* Segmented Auth Navigation */}
        <div
          role="tablist"
          aria-label="Authentication Mode"
          className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="py-2 px-3 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-2xs transition-all"
          >
            Log In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            onClick={onNavigateToRegister}
            className="py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all"
          >
            Sign Up
          </button>
        </div>

        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Sign in to your workspace
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Enter your email address and password to access MARS.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs leading-relaxed">
            {error}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={handleOpenRecoveryModal}
                className="text-[11px] text-slate-500 hover:text-slate-900 font-medium hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-9 pr-9 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-0"
              />
              <span>Remember me on this browser</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            {loading ? (
              <span>Signing In...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer Registration & Setup Links */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-2 text-center text-xs text-slate-500">
          {canShowCreateAccount ? (
            <div>
              {authPolicy.registrationPolicy === 'public_registration'
                ? 'Need a workspace account? '
                : 'Have an invitation code? '}
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="font-semibold text-slate-900 hover:underline"
              >
                Create an Account
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Accounts are provisioned directly by your organization administrator.
            </p>
          )}

          {!systemConfig.initialized && (
            <div className="pt-1">
              First time setup?{' '}
              <button
                type="button"
                onClick={onNavigateToSetup}
                className="font-semibold text-blue-700 hover:underline"
              >
                Configure Super Admin &amp; Organization
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security notice */}
      <div className="mt-6 text-center text-[11px] text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
        <span>Email &amp; Password Authentication · Role-Based Workspace Security</span>
      </div>

      {/* Administrator-Assisted Password Recovery Modal */}
      {isRecoveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Request Password Recovery Assistance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Submit a recovery request to your workspace administrator for identity verification. No external email service is required.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {recoveryError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {recoveryError}
              </div>
            )}

            {recoverySuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Recovery Request Submitted</p>
                    <p className="leading-relaxed text-emerald-900">
                      Your request for <strong>{recoveryEmail}</strong> has been logged in the Administration Hub. An administrator will verify your identity and assist you with restoring access.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecoveryModalOpen(false)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitRecovery} className="space-y-3.5 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-600 flex items-start gap-2">
                  <BadgeInfo className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    For security, passwords are never emailed or stored in plain text. Administrators verify recovery requests directly in the Administration Hub.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Account Email Address *
                  </label>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee ID <span className="font-normal text-slate-400">(Optional verification)</span>
                  </label>
                  <input
                    type="text"
                    value={recoveryEmployeeId}
                    onChange={(e) => setRecoveryEmployeeId(e.target.value)}
                    placeholder="e.g. EMP-1042"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Note for Administrator <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    maxLength={350}
                    value={recoveryNote}
                    onChange={(e) => setRecoveryNote(e.target.value)}
                    placeholder="Department, manager name, or contact extension for quick verification..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRecoveryModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                  >
                    {recoveryLoading ? 'Submitting...' : 'Submit Recovery Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
