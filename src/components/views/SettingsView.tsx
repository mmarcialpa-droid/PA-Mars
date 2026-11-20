import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  Briefcase,
  Key,
  Save,
  Edit2,
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmailConfigurationPanel } from '../admin/EmailConfigurationPanel';
import { AuthPolicyPanel } from '../admin/AuthPolicyPanel';

export const SettingsView: React.FC = () => {
  const {
    firebaseUser,
    currentUser,
    departments,
    positions,
    roles,
    userEffectivePermissions,
    isSuperAdmin,
    isAdmin,
    setActiveView,
    settingsTab,
    setSettingsTab,
    updateOwnProfile,
    changePassword,
    showToast
  } = useApp();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [saving, setSaving] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName || '');
      setLastName(currentUser.lastName || '');
      setPhone(currentUser.phone || '');
      setBio(currentUser.bio || '');
    }
  }, [currentUser]);

  const userDept = departments.find((d) => d.id === currentUser?.departmentId);
  const userPos = positions.find((p) => p.id === currentUser?.positionId);
  const userRoles = roles.filter((r) => (currentUser?.roleIds || []).includes(r.id));
  const canManageAdminSettings = isSuperAdmin || isAdmin;
  const activeTab =
    settingsTab === 'email_configuration' && !canManageAdminSettings
      ? 'profile'
      : settingsTab;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      await updateOwnProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        bio: bio.trim()
      });
      setIsEditingProfile(false);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must differ from your current password.');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to update password.';
      setPasswordError(msg);
      showToast('error', msg);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
            User & Workspace Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personal profile, password security, role authorizations, and optional notification delivery settings.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setSettingsTab('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'profile'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & Permissions</span>
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab('authentication')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'authentication'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Authentication</span>
          </button>
          {canManageAdminSettings && (
            <button
              type="button"
              onClick={() => setSettingsTab('email_configuration')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'email_configuration'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Configuration</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'email_configuration' && canManageAdminSettings ? (
        <EmailConfigurationPanel />
      ) : activeTab === 'authentication' ? (
        <div className="space-y-6">
          {/* Password Change & Account Security Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-700" />
                  <span>Password & Account Security</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your Firebase Authentication password. You will re-authenticate with your current password before saving.
                </p>
              </div>
              {firebaseUser && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 self-start sm:self-auto">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Email &amp; Password Account Active</span>
                </span>
              )}
            </div>

            {passwordError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Your Firebase Authentication password has been updated.</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Current Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
                  >
                    {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPasswords ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Password *
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {canManageAdminSettings && <AuthPolicyPanel />}
        </div>
      ) : (
        <>
          {/* User Profile Card */}
          {currentUser && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-700" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    My Profile & Organizational Assignment
                  </h2>
                </div>

                {!isEditingProfile && (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bio / Role Focus</label>
                    <textarea
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Brief summary of responsibilities..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-1 text-xs">
                    <h3 className="text-base font-bold text-slate-900">{currentUser.name}</h3>
                    <p className="text-slate-500 font-mono">{currentUser.email}</p>
                    {currentUser.bio && <p className="text-slate-600">{currentUser.bio}</p>}
                    {currentUser.phone && <p className="text-slate-500 font-mono">Tel: {currentUser.phone}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-slate-600 pt-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <strong>Dept:</strong> {userDept?.name || 'Unassigned'}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <strong>Position:</strong> {userPos ? `${userPos.title} (Level ${userPos.level})` : 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Assigned Access Roles:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {userRoles.map((r) => (
                    <span
                      key={r.id}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        r.id === 'role_super_admin'
                          ? 'bg-amber-100 text-amber-900'
                          : r.id === 'role_admin'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>

              {(isSuperAdmin || isAdmin) && (
                <div className="pt-2">
                  <button
                    onClick={() => setActiveView('admin_hub')}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    Open Administration Hub
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Permissions Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Active Effective Permissions ({userEffectivePermissions.size})
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Permissions calculated dynamically from your assigned organizational roles.
            </p>

            <div className="max-h-48 overflow-y-auto pr-1 flex flex-wrap gap-1.5 pt-1">
              {Array.from(userEffectivePermissions).map((perm) => (
                <span
                  key={perm}
                  className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono border border-slate-200/80"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

