import React, { useState } from 'react';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PendingApprovalScreen: React.FC = () => {
  const { currentUser, authPolicy, refreshOrgData, signOut } = useApp();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refreshOrgData();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-slate-50 text-slate-800 px-4 py-8">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-7 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            Pending Administrator Approval
          </span>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Awaiting Administrator Approval
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your account <strong>{currentUser?.email}</strong> has been created for{' '}
            <strong>{authPolicy.organizationName || 'MARS'}</strong> and is currently queued for administrator review.
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed space-y-1">
          <p>
            Once an administrator approves your registration and assigns your department, position, and role, you will gain full access to your MARS workspace.
          </p>
          {currentUser?.employeeId && (
            <p className="text-[11px] text-slate-500 font-mono-tabular pt-1">
              Employee ID: {currentUser.employeeId}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckStatus}
            className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking...' : 'Check Approval Status'}</span>
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
