import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, ShieldAlert, LogOut } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/navigation/Sidebar';
import { TopBar } from './components/navigation/TopBar';
import { HomeDashboard } from './components/dashboard/HomeDashboard';
import { ProjectsList } from './components/projects/ProjectsList';
import { ProjectWorkspace } from './components/project-workspace/ProjectWorkspace';
import { MyTasksView } from './components/views/MyTasksView';
import { ApprovalsView } from './components/views/ApprovalsView';
import { ScheduleView } from './components/views/ScheduleView';
import { NotificationsView } from './components/views/NotificationsView';
import { MyFilesView } from './components/views/MyFilesView';
import { TeamDirectoryView } from './components/views/TeamDirectoryView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';
import { AdminHub } from './components/admin/AdminHub';
import { OrgChartModal } from './components/organization/OrgChartModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { QuickCreateModal } from './components/modals/QuickCreateModal';
import { TaskDetailModal } from './components/modals/TaskDetailModal';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { OrganizationSetupDashboard } from './components/auth/OrganizationSetupDashboard';
import { PendingApprovalScreen } from './components/auth/PendingApprovalScreen';

const AccessDeniedView: React.FC<{ title: string }> = ({ title }) => {
  const { setActiveView } = useApp();
  return (
    <div className="p-8 max-w-lg mx-auto mt-12 bg-white border border-slate-200 rounded-xl text-center space-y-3 shadow-xs">
      <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-5 h-5" />
      </div>
      <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
      <p className="text-xs text-slate-500">
        Your assigned organizational role does not grant permission to view {title}. Contact your administrator if you need access.
      </p>
      <button
        type="button"
        onClick={() => setActiveView('home')}
        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
      >
        Return to Home Dashboard
      </button>
    </div>
  );
};

const AppContent: React.FC = () => {
  const {
    currentUser,
    firebaseUser,
    isAuthReady,
    systemConfig,
    activeProjectId,
    activeView,
    setActiveView,
    toast,
    dismissToast,
    isSuperAdmin,
    isAdmin,
    hasPermission,
    signOut
  } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register' | 'setup'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('code') || params.get('token')) return 'register';
    return 'login';
  });

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg mb-3">
          M
        </div>
        <p className="text-xs font-semibold text-slate-600">Initializing MARS Workspace...</p>
      </div>
    );
  }

  // Unauthenticated routes
  if (!firebaseUser) {
    if (authView === 'setup' || (!systemConfig.initialized && authView !== 'register' && authView !== 'login')) {
      return (
        <OrganizationSetupDashboard
          onCompleted={() => setAuthView('login')}
          onBackToLogin={() => setAuthView('login')}
        />
      );
    }

    if (authView === 'register') {
      return <RegisterPage onNavigateToLogin={() => setAuthView('login')} />;
    }

    return (
      <LoginPage
        onNavigateToRegister={() => setAuthView('register')}
        onNavigateToSetup={() => setAuthView('setup')}
      />
    );
  }

  // Uninitialized system setup route
  if (!systemConfig.initialized) {
    const canConfigureSetup =
      isSuperAdmin ||
      isAdmin ||
      firebaseUser.email?.toLowerCase() === 'mmarcialpa@gmail.com' ||
      (systemConfig.superAdminId && systemConfig.superAdminId === currentUser?.id);

    if (canConfigureSetup) {
      return (
        <OrganizationSetupDashboard
          onCompleted={() => setActiveView('home')}
          onBackToLogin={signOut}
        />
      );
    }

    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-7 text-center space-y-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg mx-auto">
            M
          </div>
          <h2 className="text-base font-bold text-slate-900">Organization Setup In Progress</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            You are signed in as <strong>{firebaseUser.email}</strong>, but the MARS workspace has not been launched by the Super Administrator (<strong>mmarcialpa@gmail.com</strong>) yet.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out &amp; Return to Login</span>
          </button>
        </div>
      </div>
    );
  }

  // Missing Firestore profile guard (e.g. Auth account without active org profile)
  if (!currentUser) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-7 text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Workspace Profile Not Found</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your authentication session (<strong>{firebaseUser.email}</strong>) is not linked to an active workspace profile. Contact your administrator or sign in with an invited account.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Suspended, rejected, or archived account gates
  if (currentUser.accountStatus === 'suspended') {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-7 text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Account Suspended</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your account (<strong>{currentUser.email}</strong>) has been suspended by an administrator.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (currentUser.accountStatus === 'rejected') {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-7 text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Registration Request Declined</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your registration request for <strong>{currentUser.email}</strong> was declined by an organization administrator.
          </p>
          {currentUser.rejectionReason && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 text-left">
              <strong>Administrator Note:</strong> {currentUser.rejectionReason}
            </div>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (currentUser.accountStatus === 'archived') {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-7 text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Account Archived</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            This account (<strong>{currentUser.email}</strong>) has been archived by an administrator and no longer has access to this workspace.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Pending administrator approval gate
  if (currentUser.accountStatus === 'pending_approval' || currentUser.accountStatus === 'invited') {
    return <PendingApprovalScreen />;
  }

  const canViewApprovals = isSuperAdmin || isAdmin || hasPermission('view_approval_center') || hasPermission('approve_tasks');
  const canViewReports = isSuperAdmin || isAdmin || hasPermission('view_reports');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto">
          {activeProjectId ? (
            <ProjectWorkspace />
          ) : (
            <>
              {activeView === 'home' && <HomeDashboard />}
              {activeView === 'my_tasks' && <MyTasksView />}
              {activeView === 'projects' && <ProjectsList />}
              {activeView === 'approvals' && (canViewApprovals ? <ApprovalsView /> : <AccessDeniedView title="Approvals Center" />)}
              {activeView === 'schedule' && <ScheduleView />}
              {activeView === 'notifications' && <NotificationsView />}
              {activeView === 'my_files' && <MyFilesView />}
              {activeView === 'team_directory' && <TeamDirectoryView />}
              {activeView === 'reports' && (canViewReports ? <ReportsView /> : <AccessDeniedView title="TAT & Performance Reports" />)}
              {activeView === 'admin_hub' && ((isSuperAdmin || isAdmin) ? <AdminHub /> : <AccessDeniedView title="Administration Hub" />)}
              {activeView === 'archived' && <ProjectsList />}
              {activeView === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* Global Interactive Modals */}
      <OrgChartModal />
      <GlobalSearchModal />
      <QuickCreateModal />
      <TaskDetailModal />

      {/* Global Feedback Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-70 max-w-sm px-4 py-3 rounded-xl shadow-lg border flex items-start gap-2.5 text-xs ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          ) : toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-relaxed font-medium">{toast.message}</span>
          <button type="button" onClick={dismissToast} className="opacity-60 hover:opacity-100 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
