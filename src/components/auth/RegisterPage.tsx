import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  UserCheck,
  Shield,
  ShieldCheck,
  Building2,
  Briefcase,
  Eye,
  EyeOff,
  UserPlus,
  Info,
  CheckCircle2,
  AlertCircle,
  Hash,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { userService } from '../../services/users/userService';
import { VerifiedInvitationSummary } from '../../types';
import { evaluatePasswordStrength, isValidEmailAddress } from '../../utils/authValidation';

interface RegisterPageProps {
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigateToLogin }) => {
  const {
    completeEmailInvitationRegistration,
    registerPublicUser,
    authPolicy,
    organization
  } = useApp();

  const [mode, setMode] = useState<'invitation' | 'public'>(() =>
    authPolicy.registrationPolicy === 'public_registration' ? 'public' : 'invitation'
  );

  const [codeInput, setCodeInput] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [invitation, setInvitation] = useState<VerifiedInvitationSummary | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [requestedDepartment, setRequestedDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMode, setSuccessMode] = useState<'invitation' | 'public' | null>(null);

  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Respect policy changes unless URL specifies an explicit invitation code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramCode = params.get('code') || params.get('token');
    if (paramCode) {
      setMode('invitation');
      setCodeInput(paramCode);
      verifyCode(paramCode);
    } else if (authPolicy.registrationPolicy === 'public_registration') {
      setMode('public');
    } else {
      setMode('invitation');
    }
  }, [authPolicy.registrationPolicy]);

  const verifyCode = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    setVerifyingCode(true);
    setError(null);
    try {
      const verified = await userService.verifyInvitationCode(trimmed);
      setInvitation(verified);
      setCodeVerified(true);
      setEmail(verified.email);
      if (verified.firstName) setFirstName(verified.firstName);
      if (verified.lastName) setLastName(verified.lastName);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Invalid or expired invitation code. Please check with your administrator.';
      setError(msg);
      setCodeVerified(false);
      setInvitation(null);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(codeInput);
  };

  const handleInvitationRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please provide your first and last name.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!termsAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to create your account.');
      return;
    }

    setLoading(true);
    try {
      await completeEmailInvitationRegistration({
        code: codeInput.trim(),
        email: invitation.email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        employeeId: employeeId.trim() || null,
        termsAcceptedAt: new Date().toISOString()
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      setSuccessMode('invitation');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePublicRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please provide your first and last name.');
      return;
    }
    if (!trimmedEmail || !isValidEmailAddress(trimmedEmail)) {
      setError('Please provide a valid email address (company, Gmail, Outlook, or Yahoo).');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to create your account.');
      return;
    }

    setLoading(true);
    try {
      await registerPublicUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail,
        password,
        employeeId: employeeId.trim() || null,
        requestedDepartment: requestedDepartment.trim() || null,
        termsAcceptedAt: new Date().toISOString()
      });
      setSuccessMode('public');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const orgDisplayName =
    invitation?.organizationName ||
    authPolicy.organizationName ||
    organization?.name ||
    'MARS';

  const strengthBarColors = [
    'bg-slate-200',
    'bg-rose-500',
    'bg-amber-500',
    'bg-blue-500',
    'bg-emerald-500'
  ];

  const renderPasswordFields = () => (
    <>
      <div>
        <label htmlFor="signup-password" className="block text-xs font-semibold text-slate-700 mb-1">
          Password *
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
            className="w-full pl-9 pr-9 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
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

        {password.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    passwordStrength.score >= level
                      ? strengthBarColors[passwordStrength.score]
                      : 'bg-slate-200'
                  }`}
                />
              ))}
              <span className="text-[10px] font-semibold text-slate-600 w-14 text-right">
                {passwordStrength.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
              <span className={passwordStrength.checks.minLength ? 'text-emerald-700 font-medium' : ''}>
                {passwordStrength.checks.minLength ? '✓' : '○'} 8+ chars
              </span>
              <span className={passwordStrength.checks.hasUpper && passwordStrength.checks.hasLower ? 'text-emerald-700 font-medium' : ''}>
                {passwordStrength.checks.hasUpper && passwordStrength.checks.hasLower ? '✓' : '○'} Upper &amp; lower
              </span>
              <span className={passwordStrength.checks.hasNumber ? 'text-emerald-700 font-medium' : ''}>
                {passwordStrength.checks.hasNumber ? '✓' : '○'} Number
              </span>
              <span className={passwordStrength.checks.hasSpecial ? 'text-emerald-700 font-medium' : ''}>
                {passwordStrength.checks.hasSpecial ? '✓' : '○'} Symbol
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="signup-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
          Confirm Password *
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="signup-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
            minLength={8}
            className={`w-full pl-9 pr-9 py-2 bg-slate-50/50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 ${
              passwordsMismatch
                ? 'border-rose-300 focus:ring-rose-500'
                : passwordsMatch
                ? 'border-emerald-300 focus:ring-emerald-600'
                : 'border-slate-200 focus:ring-slate-900'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            title={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {passwordsMismatch && (
          <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>Passwords do not match</span>
          </p>
        )}
        {passwordsMatch && (
          <p className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Passwords match</span>
          </p>
        )}
      </div>
    </>
  );

  const renderTermsCheckbox = () => (
    <label className="flex items-start gap-2 pt-1 cursor-pointer text-[11px] text-slate-600 select-none">
      <input
        type="checkbox"
        checked={termsAccepted}
        onChange={(e) => setTermsAccepted(e.target.checked)}
        required
        className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-0"
      />
      <span className="leading-relaxed">
        I agree to the{' '}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setIsTermsModalOpen(true);
          }}
          className="font-semibold text-slate-900 underline hover:no-underline"
        >
          Terms of Service &amp; Privacy Policy
        </button>{' '}
        for {orgDisplayName}.
      </span>
    </label>
  );

  const renderAuthTabs = () => (
    <div
      role="tablist"
      aria-label="Authentication Mode"
      className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6"
    >
      <button
        type="button"
        role="tab"
        aria-selected="false"
        onClick={onNavigateToLogin}
        className="py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all"
      >
        Log In
      </button>
      <button
        type="button"
        role="tab"
        aria-selected="true"
        className="py-2 px-3 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-2xs transition-all"
      >
        Sign Up
      </button>
    </div>
  );

  const isAdminCreatedOnly = authPolicy.registrationPolicy === 'admin_created' && !codeVerified && !codeInput.trim();

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-slate-50 text-slate-800 px-4 py-8">
      {/* Brand Header */}
      <div className="w-full max-w-md mx-auto text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white font-bold text-xl shadow-sm mb-3">
          M
        </div>
        <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
          {orgDisplayName}
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          {isAdminCreatedOnly
            ? 'Administrator-Managed Account Registration'
            : mode === 'public'
            ? 'Create your workspace account with Email & Password'
            : 'Invitation Code Registration'}
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-7">
        {renderAuthTabs()}

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isAdminCreatedOnly ? (
          <div className="text-center py-3 space-y-4">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
              <Shield className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-900">Administrator-Managed Accounts</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Public self-registration is disabled for <strong>{orgDisplayName}</strong>. New user accounts are created directly by an organization administrator.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                If an administrator already created your account, switch to <strong>Log In</strong> with the initial password they shared with you.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Go to Log In
            </button>
          </div>
        ) : successMode ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {successMode === 'invitation'
                  ? 'Workspace Account Ready'
                  : 'Account Created — Pending Approval'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {successMode === 'invitation'
                  ? `Your account for ${email} has been activated with your assigned department and roles.`
                  : `Your account for ${email} has been created and queued for administrator approval. You can sign in once an administrator approves your request.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Return to Log In
            </button>
          </div>
        ) : mode === 'public' ? (
          /* Public Self-Registration Form */
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-slate-700" />
                <span>Create Account</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Sign up with any valid email address. Administrator approval is required before accessing projects.
              </p>
            </div>

            <div className="mb-4 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-600 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                New registrations start in Pending Approval status. An administrator assigns your final department, position, and role upon review.
              </span>
            </div>

            <form onSubmit={handlePublicRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="signup-first-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name *
                  </label>
                  <input
                    id="signup-first-name"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="Jane"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="signup-last-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    id="signup-last-name"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Doe"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@company.com or personal@gmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="signup-employee-id" className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee ID <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      id="signup-employee-id"
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      maxLength={40}
                      placeholder="EMP-1042"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="signup-requested-dept" className="block text-xs font-semibold text-slate-700 mb-1">
                    Department <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      id="signup-requested-dept"
                      type="text"
                      value={requestedDepartment}
                      onChange={(e) => setRequestedDepartment(e.target.value)}
                      maxLength={100}
                      placeholder="e.g. Operations"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {renderPasswordFields()}
              {renderTermsCheckbox()}

              <button
                type="submit"
                disabled={loading || !termsAccepted}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs mt-2"
              >
                {loading ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2 text-center text-xs text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('invitation');
                }}
                className="text-slate-600 hover:text-slate-900 font-medium hover:underline"
              >
                Have an invitation code instead?
              </button>
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        ) : !codeVerified ? (
          /* Invitation Mode Step 1: Code Verification */
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Sign Up with Invitation Code
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter the one-time invitation code shared by your MARS administrator.
              </p>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label htmlFor="signup-invite-code" className="block text-xs font-semibold text-slate-700 mb-1">
                  Invitation Code *
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="signup-invite-code"
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="MARS-XXXX-XXXX-XXXX"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyingCode || !codeInput.trim()}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                {verifyingCode ? (
                  <span>Verifying Invitation Code...</span>
                ) : (
                  <>
                    <span>Verify Invitation Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-2 text-center text-xs text-slate-500">
              {authPolicy.registrationPolicy === 'public_registration' && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('public');
                  }}
                  className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
                >
                  Sign up without an invitation code
                </button>
              )}
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Invitation Mode Step 2: Email & Password Account Setup */
          <div>
            <div className="mb-4">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Verified Invitation
              </p>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                Complete Your Account Setup
              </h2>
            </div>

            {/* Read-only Verified Assignment Card */}
            <div className="mb-5 p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-slate-800">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{email}</span>
              </div>
              {invitation?.departmentName && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Department: {invitation.departmentName}</span>
                </div>
              )}
              {invitation?.positionTitle && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Position: {invitation.positionTitle}</span>
                </div>
              )}
              {invitation && invitation.roleNames.length > 0 && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>Role: {invitation.roleNames.join(', ')}</span>
                </div>
              )}
              {invitation && (
                <div className="text-[11px] text-slate-400 pt-1 font-mono-tabular">
                  Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </div>
              )}
            </div>

            <form onSubmit={handleInvitationRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="invite-first-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name *
                  </label>
                  <input
                    id="invite-first-name"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="Jane"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="invite-last-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    id="invite-last-name"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Doe"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="invite-employee-id" className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee ID <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="invite-employee-id"
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    maxLength={40}
                    placeholder="EMP-1042"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {renderPasswordFields()}
              {renderTermsCheckbox()}

              <button
                type="submit"
                disabled={loading || !termsAccepted}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs mt-2"
              >
                {loading ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2 text-center text-xs text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setCodeVerified(false);
                  setInvitation(null);
                  setError(null);
                }}
                className="text-slate-500 hover:text-slate-800"
              >
                Use a different invitation code
              </button>
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security notice */}
      <div className="mt-6 text-center text-[11px] text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
        <span>Email &amp; Password Authentication · Protected Organizational Access</span>
      </div>

      {/* Terms & Privacy Summary Modal */}
      {isTermsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Terms of Service &amp; Privacy Policy
              </h3>
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-72 overflow-y-auto pr-1">
              <p>
                <strong>1. Authorized Organizational Access:</strong> Workspace accounts in {orgDisplayName} are governed by organizational role, department, and administrator approval policies.
              </p>
              <p>
                <strong>2. Account Security:</strong> Credentials are managed directly by Firebase Authentication. Passwords are never stored in plain text or exposed to workspace administrators.
              </p>
              <p>
                <strong>3. Audit &amp; Governance:</strong> Administrative actions, project collaboration records, and task approvals are logged to maintain accountability across the organization.
              </p>
              <p>
                <strong>4. Data Privacy:</strong> Your profile details (name, email address, employee ID, department, and position assignments) are used strictly for project coordination and access control within {orgDisplayName}.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTermsAccepted(true);
                  setIsTermsModalOpen(false);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Accept &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
