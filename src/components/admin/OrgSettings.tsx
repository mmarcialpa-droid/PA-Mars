import React, { useState } from 'react';
import { Building2, Save, Check, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const OrgSettings: React.FC = () => {
  const { organization, updateOrganizationSettings, isSuperAdmin, showToast } = useApp();

  const [name, setName] = useState(organization?.name || '');
  const [companyEmail, setCompanyEmail] = useState(organization?.companyEmail || '');
  const [contactNumber, setContactNumber] = useState(organization?.contactNumber || '');
  const [officeAddress, setOfficeAddress] = useState(organization?.officeAddress || '');
  const [description, setDescription] = useState(organization?.description || '');
  const [timezone, setTimezone] = useState(organization?.timezone || 'America/New_York');
  const [logoUrl, setLogoUrl] = useState(organization?.logoUrl || '');

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      await updateOrganizationSettings({
        name: name.trim(),
        companyEmail: companyEmail.trim(),
        contactNumber: contactNumber.trim(),
        officeAddress: officeAddress.trim(),
        description: description.trim(),
        timezone,
        logoUrl: logoUrl.trim() || ''
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update organization settings.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setCompanyEmail(organization.companyEmail || '');
      setContactNumber(organization.contactNumber || '');
      setOfficeAddress(organization.officeAddress || '');
      setDescription(organization.description || '');
      setTimezone(organization.timezone || 'America/New_York');
      setLogoUrl(organization.logoUrl || '');
    }
  }, [organization]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Organization Profile & Localization
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Workspace identity, company contact details, default timezones, and branding.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isSuperAdmin}
              required
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Company Email
              </label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                disabled={!isSuperAdmin}
                placeholder="contact@company.com"
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Contact Number
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                disabled={!isSuperAdmin}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Office Address
            </label>
            <input
              type="text"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              disabled={!isSuperAdmin}
              placeholder="Street, Suite, City, Country"
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Organization Mission / Summary
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isSuperAdmin}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Primary Organization Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!isSuperAdmin}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
            >
              <option value="America/New_York">Eastern Time (America/New_York)</option>
              <option value="America/Chicago">Central Time (America/Chicago)</option>
              <option value="America/Denver">Mountain Time (America/Denver)</option>
              <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
              <option value="UTC">Coordinated Universal Time (UTC)</option>
              <option value="Asia/Tokyo">Japan Time (Asia/Tokyo)</option>
              <option value="Asia/Manila">Philippine Time (Asia/Manila)</option>
              <option value="Europe/London">London Time (Europe/London)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Organization Logo URL (Optional)
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={!isSuperAdmin}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
            />
          </div>

          {isSuperAdmin && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {saved ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Changes saved successfully!</span>
                </span>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{loading ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
