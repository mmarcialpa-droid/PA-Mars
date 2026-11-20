import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Unsubscribe } from 'firebase/firestore';
import { 
  User, 
  Project, 
  Task, 
  Discussion, 
  Comment, 
  ProjectFile, 
  ScheduleEvent, 
  ActivityItem, 
  NotificationItem, 
  ProjectMember, 
  TaskStatus, 
  ProjectStatistics,
  Attachment,
  Department,
  Position,
  Role,
  Organization,
  SystemConfig,
  Invitation,
  RegistrationRequest,
  PasswordRecoveryRequest,
  AuditLog,
  PermissionScope,
  SetupSectionKey,
  SectionSaveState,
  AuthPolicyState,
  RegistrationPolicy
} from '../types';
import { INITIAL_SYSTEM_CONFIG } from '../data/initialData';
import { ALL_PERMISSION_IDS } from '../constants/permissions';
import { auth, testConnection } from '../services/firebase/firebase';
import { authService } from '../services/auth/authService';
import { organizationService } from '../services/organization/organizationService';
import { roleService } from '../services/roles/roleService';
import { userService, InvitationApiError, InvitationDeliveryResponse } from '../services/users/userService';
import { clearGmailSession, getGmailAccessToken } from '../services/gmail/gmailOAuthService';
import { auditService } from '../services/audit/auditService';
import { projectService } from '../services/projects/projectService';
import { taskService } from '../services/tasks/taskService';
import { commentService } from '../services/comments/commentService';
import { discussionService } from '../services/discussions/discussionService';
import { notificationService } from '../services/notifications/notificationService';
import { fileService } from '../services/files/fileService';
import { scheduleService } from '../services/schedule/scheduleService';
import { activityService } from '../services/activities/activityService';

export type GlobalNavView = 
  | 'home' 
  | 'my_tasks' 
  | 'projects' 
  | 'schedule' 
  | 'approvals' 
  | 'notifications' 
  | 'my_files' 
  | 'team_directory' 
  | 'reports' 
  | 'admin_hub' 
  | 'archived'
  | 'settings';

export type AdminSection = 
  | 'overview' 
  | 'users' 
  | 'registrations'
  | 'departments' 
  | 'positions' 
  | 'roles' 
  | 'invitations' 
  | 'auth_policy'
  | 'email_settings'
  | 'audit_logs' 
  | 'org_settings';

export type SettingsTab = 'profile' | 'authentication' | 'email_configuration';

export type ProjectTab = 
  | 'overview' 
  | 'todos' 
  | 'discussions' 
  | 'files' 
  | 'schedule' 
  | 'activity' 
  | 'approvals' 
  | 'members';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  // Feedback Toast
  toast: ToastNotification | null;
  showToast: (type: ToastNotification['type'], message: string) => void;
  dismissToast: () => void;

  // Authentication & Session
  firebaseUser: FirebaseUser | null;
  currentUser: User | null;
  isAuthReady: boolean;
  isSyncingWorkspace: boolean;
  authPolicy: AuthPolicyState;
  signInWithEmail: (email: string, pass: string, rememberMe?: boolean) => Promise<User | null>;
  registerWithEmail: (email: string, pass: string, extra?: Partial<User>) => Promise<User>;
  registerPublicUser: (params: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    employeeId?: string | null;
    requestedDepartment?: string | null;
    termsAcceptedAt?: string;
  }) => Promise<User>;
  completeEmailInvitationRegistration: (params: {
    code: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    employeeId?: string | null;
    termsAcceptedAt?: string;
  }) => Promise<User>;
  submitPasswordRecoveryRequest: (params: {
    email: string;
    employeeId?: string | null;
    note?: string | null;
  }) => Promise<PasswordRecoveryRequest>;
  resolvePasswordRecoveryRequest: (
    requestId: string,
    updates: {
      status: 'approved' | 'resolved' | 'dismissed';
      resolutionNote?: string | null;
    }
  ) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateOwnProfile: (updates: { firstName: string; lastName: string; phone?: string; bio?: string }) => Promise<void>;
  updateAuthPolicy: (updates: {
    registrationPolicy: RegistrationPolicy;
    requireEmailVerification: boolean;
    requireAdminApproval: boolean;
  }) => Promise<AuthPolicyState>;
  adminCreateUserAccount: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    employeeId?: string | null;
    departmentId?: string | null;
    positionId?: string | null;
    roleIds: string[];
    temporaryPassword?: string;
  }) => Promise<{ user: User; initialPassword?: string }>;
  approvePendingUser: (userId: string) => Promise<void>;
  approveRegistrationRequest: (
    userId: string,
    assignments?: {
      departmentId?: string | null;
      positionId?: string | null;
      managerId?: string | null;
      roleIds?: string[];
    }
  ) => Promise<void>;
  rejectRegistrationRequest: (userId: string, reason?: string) => Promise<void>;
  archiveUserAccount: (userId: string) => Promise<void>;
  deleteUserAccount: (userId: string) => Promise<void>;

  // System & Organization Hierarchy
  systemConfig: SystemConfig;
  organization: Organization | null;
  departments: Department[];
  positions: Position[];
  roles: Role[];
  allUsers: User[];
  users: User[];
  projectMembers: Record<string, ProjectMember[]>;
  invitations: Invitation[];
  registrationRequests: RegistrationRequest[];
  passwordRecoveryRequests: PasswordRecoveryRequest[];
  auditLogs: AuditLog[];
  refreshOrgData: () => Promise<void>;

  // Permissions & Authorization
  isSuperAdmin: boolean;
  isAdmin: boolean;
  userEffectivePermissions: Set<string>;
  hasPermission: (permissionId: string, targetScope?: PermissionScope) => boolean;
  isApproverForProject: (projectId: string) => boolean;
  canManageProject: (project: Project) => boolean;

  // Organization Administration & Persistent Setup Dashboard Actions
  bootstrapSystem: (
    orgData: { name: string; description?: string; logoUrl?: string; timezone: string },
    adminInfo: { email: string; firstName: string; lastName: string },
    initialDepts?: Partial<Department>[],
    initialPositions?: Partial<Position>[]
  ) => Promise<void>;
  saveSetupOrganization: (data: {
    name: string;
    logoUrl?: string;
    companyEmail?: string;
    contactNumber?: string;
    officeAddress?: string;
    description?: string;
    timezone: string;
  }) => Promise<{ organization: Organization; systemConfig: SystemConfig }>;
  saveSetupSuperAdmin: (profile: {
    firstName: string;
    lastName: string;
    email: string;
  }) => Promise<{ superAdminUser: User; organization: Organization; systemConfig: SystemConfig }>;
  uploadOrganizationLogo: (orgId: string, file: File, onProgress?: (pct: number) => void) => Promise<string>;
  updateSetupProgress: (updates: Partial<SystemConfig>) => Promise<SystemConfig>;
  launchOrganization: () => Promise<void>;
  createDepartment: (data: Partial<Department>) => Promise<Department>;
  updateDepartment: (deptId: string, updates: Partial<Department>) => Promise<void>;
  deleteDepartment: (deptId: string) => Promise<void>;
  createPosition: (data: Partial<Position>) => Promise<Position>;
  updatePosition: (posId: string, updates: Partial<Position>) => Promise<void>;
  deletePosition: (posId: string) => Promise<void>;
  createRole: (data: Partial<Role>) => Promise<Role>;
  updateRole: (roleId: string, updates: Partial<Role>) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
  inviteEmployee: (data: {
    email: string;
    firstName?: string;
    lastName?: string;
    departmentId?: string | null;
    positionId?: string | null;
    roleIds: string[];
    expirationDays?: number;
    allowDuplicate?: boolean;
  }) => Promise<InvitationDeliveryResponse>;
  resendInvitation: (invitationId: string) => Promise<InvitationDeliveryResponse>;
  revokeInvitation: (invitationId: string) => Promise<Invitation>;
  suspendUser: (userId: string) => Promise<void>;
  reactivateUser: (userId: string) => Promise<void>;
  updateUserAssignments: (userId: string, updates: Partial<User>) => Promise<void>;
  updateOrganizationSettings: (updates: Partial<Organization>) => Promise<void>;

  // Navigation
  activeView: GlobalNavView;
  setActiveView: (view: GlobalNavView) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  openEmailConfiguration: () => void;
  activeAdminSection: AdminSection;
  setActiveAdminSection: (sec: AdminSection) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeProjectTab: ProjectTab;
  setActiveProjectTab: (tab: ProjectTab) => void;

  // Projects
  projects: Project[];
  activeProject: Project | null;
  createProject: (data: Partial<Project>) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  addProjectMember: (projectId: string, userId: string, role: ProjectMember['role']) => Promise<void>;
  removeProjectMember: (projectId: string, userId: string) => Promise<void>;

  // Tasks
  tasks: Task[];
  createTask: (data: Partial<Task>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTaskStatus: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  startTask: (taskId: string) => Promise<void>;
  submitTaskForApproval: (taskId: string, remarks: string, attachments?: Attachment[]) => Promise<void>;
  requestTaskRevision: (taskId: string, notes: string) => Promise<void>;
  approveTask: (taskId: string) => Promise<void>;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;

  // Discussions
  discussions: Discussion[];
  createDiscussion: (data: Partial<Discussion>) => Promise<Discussion>;
  togglePinDiscussion: (id: string) => Promise<void>;
  deleteDiscussion: (projectId: string, id: string) => Promise<void>;

  // Comments
  comments: Comment[];
  addComment: (data: {
    projectId: string;
    targetType: Comment['targetType'];
    targetId: string;
    content: string;
    parentCommentId?: string | null;
    mentions?: string[];
    attachments?: Attachment[];
  }) => Promise<Comment>;
  toggleReaction: (commentId: string, emoji: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;

  // Files
  files: ProjectFile[];
  uploadFile: (data: {
    projectId: string;
    file?: File | null;
    name?: string;
    folder: string;
    url?: string;
    type?: string;
    size?: string;
    onProgress?: (pct: number) => void;
  }) => Promise<ProjectFile>;
  deleteFile: (projectId: string, fileId: string, fileUrl?: string) => Promise<void>;
  downloadFile: (file: ProjectFile) => Promise<void>;

  // Schedule
  events: ScheduleEvent[];
  createEvent: (data: Omit<ScheduleEvent, 'id'>) => Promise<ScheduleEvent>;
  deleteEvent: (projectId: string, eventId: string) => Promise<void>;

  // Activities & Notifications
  activities: ActivityItem[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;

  // Quick Create & Search Modals
  isQuickCreateOpen: boolean;
  setIsQuickCreateOpen: (open: boolean) => void;
  quickCreateType: 'task' | 'project' | 'discussion' | 'file' | null;
  setQuickCreateType: (type: 'task' | 'project' | 'discussion' | 'file' | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  // Visual Org Chart Modal
  isOrgChartOpen: boolean;
  setIsOrgChartOpen: (open: boolean) => void;

  // Statistics
  getProjectStats: (projectId: string) => ProjectStatistics;
  globalStats: {
    totalProjects: number;
    activeTasks: number;
    awaitingApproval: number;
    forRevision: number;
    overdueTasks: number;
    completedThisMonth: number;
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Toast State
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((type: ToastNotification['type'], message: string) => {
    const id = `toast_${Date.now()}`;
    setToast({ id, type, message });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 5000);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // Authentication State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSyncingWorkspace, setIsSyncingWorkspace] = useState(false);

  // System & Organization State
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(INITIAL_SYSTEM_CONFIG);
  const [authPolicy, setAuthPolicy] = useState<AuthPolicyState>({
    initialized: false,
    organizationId: null,
    organizationName: null,
    registrationPolicy: 'invitation_only',
    requireEmailVerification: false,
    requireAdminApproval: true
  });
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [passwordRecoveryRequests, setPasswordRecoveryRequests] = useState<PasswordRecoveryRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Workspace Navigation
  const [activeView, setActiveView] = useState<GlobalNavView>('home');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('profile');
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSection>('overview');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>('overview');

  const openEmailConfiguration = useCallback(() => {
    setActiveProjectId(null);
    setActiveView('settings');
    setSettingsTab('email_configuration');
  }, []);

  // Real-time Firestore-backed Workspace State (keyed per project where applicable)
  const [rawProjects, setRawProjects] = useState<Project[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, ProjectMember[]>>({});
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [discussionsByProject, setDiscussionsByProject] = useState<Record<string, Discussion[]>>({});
  const [commentsByProject, setCommentsByProject] = useState<Record<string, Comment[]>>({});
  const [filesByProject, setFilesByProject] = useState<Record<string, ProjectFile[]>>({});
  const [eventsByProject, setEventsByProject] = useState<Record<string, ScheduleEvent[]>>({});
  const [activitiesByProject, setActivitiesByProject] = useState<Record<string, ActivityItem[]>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Track active per-project listener subscriptions
  const projectListenersRef = useRef<Map<string, Unsubscribe[]>>(new Map());
  // Prevent onAuthStateChanged from auto-creating a default user profile during atomic registration
  const invitationRegistrationLockRef = useRef(false);
  // Keep latest currentUser available to stable callbacks like refreshOrgData
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<'task' | 'project' | 'discussion' | 'file' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOrgChartOpen, setIsOrgChartOpen] = useState(false);

  // Clean up any legacy localStorage workspace blobs so Firestore is the single source of truth
  useEffect(() => {
    const legacyKeys = [
      'mars_projects_prod',
      'mars_tasks_prod',
      'mars_discussions_prod',
      'mars_comments_prod',
      'mars_files_prod',
      'mars_events_prod',
      'mars_activities_prod',
      'mars_notifications_prod',
      'mars_current_user_prod'
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));
  }, []);

  // Load organization and system state (supports both initialized and in-progress setup drafts)
  const refreshOrgData = useCallback(async (opts?: { fbUser?: FirebaseUser | null; profile?: User | null }) => {
    try {
      const [config, serverPolicy] = await Promise.all([
        organizationService.getSystemConfig(),
        userService.getAuthPolicy().catch(() => null)
      ]);
      setSystemConfig(config);

      const activeFbUser = opts?.fbUser !== undefined ? opts.fbUser : auth.currentUser;
      const activeProfile = opts?.profile !== undefined ? opts.profile : currentUserRef.current;

      let loadedOrg: Organization | null = null;
      if (activeFbUser && config.organizationId) {
        const orgId = config.organizationId;
        const isPrimaryOwner = activeFbUser.email?.toLowerCase() === 'mmarcialpa@gmail.com';
        const isCallerAdmin =
          isPrimaryOwner ||
          Boolean(
            activeProfile &&
              activeProfile.accountStatus === 'active' &&
              Array.isArray(activeProfile.roleIds) &&
              activeProfile.roleIds.some((r) => ['role_super_admin', 'role_admin', 'super_admin'].includes(r))
          );
        const canListUsers = isCallerAdmin || activeProfile?.accountStatus === 'active';

        const [org, depts, posList, roleList, userList, invList, logs] = await Promise.all([
          organizationService.getOrganization(orgId).catch(() => null),
          organizationService.getDepartments(orgId).catch(() => []),
          organizationService.getPositions(orgId).catch(() => []),
          roleService.getRoles(orgId).catch(() => []),
          canListUsers ? userService.getUsers(orgId).catch(() => []) : Promise.resolve([] as User[]),
          isCallerAdmin ? userService.getInvitations(orgId).catch(() => []) : Promise.resolve([] as Invitation[]),
          isCallerAdmin ? auditService.getAuditLogs(orgId, 50).catch(() => []) : Promise.resolve([] as AuditLog[])
        ]);

        if (org) {
          loadedOrg = org;
          setOrganization(org);
        }
        if (depts) setDepartments(depts);
        if (posList) setPositions(posList);
        if (roleList) setRoles(roleList);
        if (userList) setAllUsers(userList);
        if (invList) setInvitations(invList);
        if (logs) setAuditLogs(logs);
      } else if (!activeFbUser) {
        setOrganization(null);
        setDepartments([]);
        setPositions([]);
        setRoles([]);
        setAllUsers([]);
        setInvitations([]);
        setRegistrationRequests([]);
        setPasswordRecoveryRequests([]);
        setAuditLogs([]);
      }

      const resolvedPolicy: RegistrationPolicy =
        loadedOrg?.registrationPolicy ||
        config.registrationPolicy ||
        serverPolicy?.registrationPolicy ||
        'invitation_only';
      setAuthPolicy({
        initialized: Boolean(config.initialized || serverPolicy?.initialized),
        organizationId: config.organizationId || serverPolicy?.organizationId || null,
        organizationName: loadedOrg?.name || config.organizationName || serverPolicy?.organizationName || null,
        registrationPolicy: resolvedPolicy,
        requireEmailVerification:
          loadedOrg?.requireEmailVerification ??
          config.requireEmailVerification ??
          serverPolicy?.requireEmailVerification ??
          false,
        requireAdminApproval:
          loadedOrg?.requireAdminApproval ??
          config.requireAdminApproval ??
          serverPolicy?.requireAdminApproval ??
          true
      });
    } catch (err) {
      console.warn('Organization data fetch error:', err);
    }
  }, []);

  // Mount effect: test connection, check system initialization & subscribe to auth
  useEffect(() => {
    testConnection();
    refreshOrgData({ fbUser: auth.currentUser });

    const unsubscribe = authService.onAuthState(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        if (invitationRegistrationLockRef.current) {
          setIsAuthReady(true);
          return;
        }
        try {
          const profile = await authService.syncUserProfile(fbUser);
          if (profile && profile.accountStatus === 'suspended') {
            await authService.signOut();
            setCurrentUser(null);
            showToast('error', 'Your account has been suspended by an administrator.');
          } else if (profile) {
            setCurrentUser(profile);
            await refreshOrgData({ fbUser, profile });
          } else {
            setCurrentUser(null);
            await refreshOrgData({ fbUser, profile: null });
          }
        } catch (err) {
          console.error('Profile sync error:', err);
          showToast('error', 'Could not synchronize user profile with Firestore.');
        }
      } else {
        clearGmailSession();
        setCurrentUser(null);
        await refreshOrgData({ fbUser: null, profile: null });
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [refreshOrgData, showToast]);

  // Compute effective permissions
  const isSuperAdmin = useMemo(() => {
    if (!currentUser) return false;
    const userRoleIds = Array.isArray(currentUser.roleIds) ? currentUser.roleIds : [];
    return userRoleIds.includes('role_super_admin') || currentUser.email === 'mmarcialpa@gmail.com';
  }, [currentUser]);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (isSuperAdmin) return true;
    const userRoleIds = Array.isArray(currentUser.roleIds) ? currentUser.roleIds : [];
    return userRoleIds.includes('role_admin');
  }, [currentUser, isSuperAdmin]);

  const userEffectivePermissions = useMemo(() => {
    if (!currentUser) return new Set<string>();
    if (isSuperAdmin) return new Set(ALL_PERMISSION_IDS);
    const userRoleIds = Array.isArray(currentUser.roleIds) ? currentUser.roleIds : [];
    const assignedRoles = roles.filter(r => userRoleIds.includes(r.id));
    return roleService.getEffectivePermissions(assignedRoles).permissions;
  }, [currentUser, roles, isSuperAdmin]);

  const hasPermission = useCallback((permissionId: string, targetScope?: PermissionScope): boolean => {
    if (!currentUser) return false;
    return roleService.hasPermission(currentUser, roles, permissionId, targetScope);
  }, [currentUser, roles]);

  // Real-time Firestore listeners for Workspace Projects, Users, and Notifications
  useEffect(() => {
    const canSyncActiveWorkspace =
      isAuthReady &&
      Boolean(firebaseUser) &&
      Boolean(currentUser) &&
      currentUser?.accountStatus === 'active';

    if (!canSyncActiveWorkspace) {
      // Unsubscribe all per-project listeners and clear workspace state when signed out or pending approval
      projectListenersRef.current.forEach((unsubs) => unsubs.forEach((u) => u()));
      projectListenersRef.current.clear();
      setRawProjects([]);
      setMembersByProject({});
      setTasksByProject({});
      setDiscussionsByProject({});
      setCommentsByProject({});
      setFilesByProject({});
      setEventsByProject({});
      setActivitiesByProject({});
      setNotifications([]);
      setRegistrationRequests([]);
      setPasswordRecoveryRequests([]);
      return;
    }

    setIsSyncingWorkspace(true);

    const unsubProjects = projectService.listenToProjects(
      {
        userId: currentUser.id,
        isAdmin: isAdmin || isSuperAdmin,
        departmentId: currentUser.departmentId ?? null
      },
      (projs) => {
        setRawProjects(projs);
        setIsSyncingWorkspace(false);
      }
    );

    const unsubNotifs = notificationService.listenToUserNotifications(currentUser.id, (notifs) => {
      setNotifications(notifs);
    });

    let unsubUsers: Unsubscribe | null = null;
    let unsubInvitations: Unsubscribe | null = null;
    let unsubRegRequests: Unsubscribe | null = null;
    let unsubRecoveryRequests: Unsubscribe | null = null;
    const orgId = systemConfig.organizationId || currentUser.organizationId;
    if (orgId) {
      unsubUsers = userService.listenToUsers(orgId, (usersList) => {
        setAllUsers(usersList);
        const updatedMe = usersList.find((u) => u.id === currentUser.id);
        if (updatedMe) {
          setCurrentUser(updatedMe);
        }
      });
      if (isAdmin || isSuperAdmin) {
        unsubInvitations = userService.listenToInvitations(orgId, (invList) => {
          setInvitations(invList);
        });
        unsubRegRequests = userService.listenToRegistrationRequests(orgId, (reqList) => {
          setRegistrationRequests(reqList);
        });
        unsubRecoveryRequests = userService.listenToPasswordRecoveryRequests((recList) => {
          setPasswordRecoveryRequests(recList);
        });
      }
    }

    return () => {
      unsubProjects();
      unsubNotifs();
      if (unsubUsers) unsubUsers();
      if (unsubInvitations) unsubInvitations();
      if (unsubRegRequests) unsubRegRequests();
      if (unsubRecoveryRequests) unsubRecoveryRequests();
    };
  }, [
    isAuthReady,
    firebaseUser?.uid,
    currentUser?.id,
    currentUser?.accountStatus,
    currentUser?.departmentId,
    systemConfig.organizationId,
    isAdmin,
    isSuperAdmin
  ]);

  // Attach/detach per-project subcollection listeners whenever rawProjects updates
  useEffect(() => {
    if (!isAuthReady || !firebaseUser || !currentUser) return;

    const currentIds = new Set(rawProjects.map((p) => p.id));

    // Detach listeners for removed projects
    projectListenersRef.current.forEach((unsubs, projId) => {
      if (!currentIds.has(projId)) {
        unsubs.forEach((u) => u());
        projectListenersRef.current.delete(projId);
        setMembersByProject((prev) => { const n = { ...prev }; delete n[projId]; return n; });
        setTasksByProject((prev) => { const n = { ...prev }; delete n[projId]; return n; });
        setDiscussionsByProject((prev) => { const n = { ...prev }; delete n[projId]; return n; });
        setCommentsByProject((prev) => { const n = { ...prev }; delete n[projId]; return n; });
        setFilesByProject((prev) => { const n = { ...prev }; delete n[projId]; return n; });
        setEventsByProject((prev) => { const n = { ...prev }; delete n[projId]; return n; });
        setActivitiesByProject((prev) => { const n = { ...prev }; delete n[projId]; return n; });
      }
    });

    // Attach listeners for new projects
    rawProjects.forEach((proj) => {
      if (projectListenersRef.current.has(proj.id)) return;
      const projId = proj.id;

      const unsubs: Unsubscribe[] = [
        projectService.listenToProjectMembers(projId, (members) => {
          setMembersByProject((prev) => ({ ...prev, [projId]: members }));
        }),
        taskService.listenToProjectTasks(projId, (projTasks) => {
          setTasksByProject((prev) => ({ ...prev, [projId]: projTasks }));
        }),
        discussionService.listenToDiscussions(projId, (projDiscs) => {
          setDiscussionsByProject((prev) => ({ ...prev, [projId]: projDiscs }));
        }),
        commentService.listenToProjectComments(projId, (projComments) => {
          setCommentsByProject((prev) => ({ ...prev, [projId]: projComments }));
        }),
        fileService.listenToProjectFiles(projId, (projFiles) => {
          setFilesByProject((prev) => ({ ...prev, [projId]: projFiles }));
        }),
        scheduleService.listenToProjectEvents(projId, (projEvents) => {
          setEventsByProject((prev) => ({ ...prev, [projId]: projEvents }));
        }),
        activityService.listenToProjectActivities(projId, (projActs) => {
          setActivitiesByProject((prev) => ({ ...prev, [projId]: projActs }));
        })
      ];

      projectListenersRef.current.set(projId, unsubs);
    });
  }, [rawProjects, isAuthReady, firebaseUser, currentUser?.id]);

  // Cleanup all project listeners on AppProvider unmount
  useEffect(() => {
    return () => {
      projectListenersRef.current.forEach((unsubs) => unsubs.forEach((u) => u()));
      projectListenersRef.current.clear();
    };
  }, []);

  // Filter projects visible to current user based on visibility, membership, department, or admin status
  const projects = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin || isSuperAdmin) return rawProjects;

    return rawProjects.filter((p) => {
      if (p.ownerId === currentUser.id) return true;
      const members = membersByProject[p.id] || [];
      if (members.some((m) => m.userId === currentUser.id)) return true;
      if (p.visibility === 'public') return true;
      if (p.visibility === 'department' && p.departmentId && currentUser.departmentId === p.departmentId) return true;
      return false;
    });
  }, [rawProjects, membersByProject, currentUser, isAdmin, isSuperAdmin]);

  const visibleProjectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);

  const tasks = useMemo(
    () => Object.entries(tasksByProject)
      .filter(([pid]) => visibleProjectIds.has(pid))
      .flatMap(([, list]) => list),
    [tasksByProject, visibleProjectIds]
  );

  const discussions = useMemo(
    () => Object.entries(discussionsByProject)
      .filter(([pid]) => visibleProjectIds.has(pid))
      .flatMap(([, list]) => list),
    [discussionsByProject, visibleProjectIds]
  );

  const comments = useMemo(
    () => Object.entries(commentsByProject)
      .filter(([pid]) => visibleProjectIds.has(pid))
      .flatMap(([, list]) => list),
    [commentsByProject, visibleProjectIds]
  );

  const files = useMemo(
    () => Object.entries(filesByProject)
      .filter(([pid]) => visibleProjectIds.has(pid))
      .flatMap(([, list]) => list),
    [filesByProject, visibleProjectIds]
  );

  const events = useMemo(
    () => Object.entries(eventsByProject)
      .filter(([pid]) => visibleProjectIds.has(pid))
      .flatMap(([, list]) => list),
    [eventsByProject, visibleProjectIds]
  );

  const activities = useMemo(
    () => Object.entries(activitiesByProject)
      .filter(([pid]) => visibleProjectIds.has(pid))
      .flatMap(([, list]) => list)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [activitiesByProject, visibleProjectIds]
  );

  const isApproverForProject = useCallback((projectId: string): boolean => {
    if (!currentUser) return false;
    if (isSuperAdmin || isAdmin) return true;
    if (hasPermission('approve_tasks')) return true;
    const members = membersByProject[projectId] || [];
    const member = members.find((m) => m.userId === currentUser.id);
    return member?.role === 'approver' || member?.role === 'project_admin';
  }, [currentUser, isSuperAdmin, isAdmin, hasPermission, membersByProject]);

  const canManageProject = useCallback((project: Project): boolean => {
    if (!currentUser) return false;
    if (isSuperAdmin || isAdmin) return true;
    if (project.ownerId === currentUser.id) return true;
    const members = membersByProject[project.id] || [];
    const member = members.find((m) => m.userId === currentUser.id);
    return member?.role === 'project_admin' || hasPermission('edit_projects');
  }, [currentUser, isSuperAdmin, isAdmin, membersByProject, hasPermission]);

  // Auth Action Handlers (Firebase Email & Password ONLY)
  const signInWithEmail = async (email: string, pass: string, rememberMe = true): Promise<User | null> => {
    const user = await authService.signInWithEmail(email, pass, rememberMe);
    setCurrentUser(user);
    await refreshOrgData({ fbUser: auth.currentUser, profile: user });
    return user;
  };

  const registerWithEmail = async (email: string, pass: string, extra?: Partial<User>): Promise<User> => {
    const user = await authService.registerWithEmail(email, pass, {
      ...extra,
      organizationId: systemConfig.organizationId || 'org_mars_default'
    });
    setCurrentUser(user);
    await refreshOrgData({ fbUser: auth.currentUser, profile: user });
    return user;
  };

  const registerPublicUser = async (params: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    employeeId?: string | null;
    requestedDepartment?: string | null;
    termsAcceptedAt?: string;
  }): Promise<User> => {
    if (authPolicy.registrationPolicy !== 'public_registration') {
      throw new Error('Public self-registration is currently disabled for this workspace.');
    }
    const orgId = authPolicy.organizationId || systemConfig.organizationId || organization?.id;
    if (!orgId) {
      throw new Error('Organization workspace has not been initialized yet.');
    }

    invitationRegistrationLockRef.current = true;
    try {
      const created = await authService.registerPublicAccount({
        ...params,
        organizationId: orgId
      });
      setCurrentUser(created);
      await refreshOrgData({ fbUser: auth.currentUser, profile: created });
      showToast('success', 'Registration submitted for administrator approval.');
      return created;
    } finally {
      invitationRegistrationLockRef.current = false;
    }
  };

  const completeEmailInvitationRegistration = async (params: {
    code: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    employeeId?: string | null;
    termsAcceptedAt?: string;
  }): Promise<User> => {
    invitationRegistrationLockRef.current = true;
    try {
      const displayName = `${params.firstName} ${params.lastName}`.trim();
      await authService.createFirebaseEmailUser(params.email, params.password, displayName);
      const redeemed = await userService.redeemInvitationCode(params.code, {
        firstName: params.firstName,
        lastName: params.lastName,
        employeeId: params.employeeId || null,
        termsAcceptedAt: params.termsAcceptedAt
      });
      setCurrentUser(redeemed.user);
      await refreshOrgData({ fbUser: auth.currentUser, profile: redeemed.user });
      showToast('success', `Welcome to MARS, ${redeemed.user.firstName}!`);
      return redeemed.user;
    } finally {
      invitationRegistrationLockRef.current = false;
    }
  };

  const submitPasswordRecoveryRequest = async (params: {
    email: string;
    employeeId?: string | null;
    note?: string | null;
  }): Promise<PasswordRecoveryRequest> => {
    const orgId = authPolicy.organizationId || systemConfig.organizationId || organization?.id || null;
    return authService.submitPasswordRecoveryRequest({
      organizationId: orgId,
      email: params.email,
      employeeId: params.employeeId,
      note: params.note
    });
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    await authService.changePassword(currentPassword, newPassword);
    showToast('success', 'Your password has been updated.');
  };

  const signOut = async (): Promise<void> => {
    clearGmailSession();
    await authService.signOut();
    setCurrentUser(null);
    setFirebaseUser(null);
    setInvitations([]);
    setActiveProjectId(null);
    setActiveView('home');
  };

  const updateOwnProfile = async (updates: { firstName: string; lastName: string; phone?: string; bio?: string }): Promise<void> => {
    if (!currentUser) throw new Error('Not signed in.');
    const fullName = `${updates.firstName} ${updates.lastName}`.trim();
    try {
      await userService.updateUser(currentUser.id, {
        firstName: updates.firstName,
        lastName: updates.lastName,
        name: fullName,
        phone: updates.phone || '',
        bio: updates.bio || ''
      });
      setCurrentUser((prev) => prev ? { ...prev, ...updates, name: fullName } : null);
      showToast('success', 'Profile updated successfully.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to update profile.';
      showToast('error', msg);
      throw err;
    }
  };

  // Organization Bootstrap & Admin Handlers
  const bootstrapSystem = async (
    orgData: { name: string; description?: string; logoUrl?: string; timezone: string },
    adminInfo: { email: string; firstName: string; lastName: string },
    initialDepts: Partial<Department>[] = [],
    initialPositions: Partial<Position>[] = []
  ): Promise<void> => {
    if (!currentUser && !firebaseUser) {
      throw new Error('An authenticated session is required to initialize the Super Administrator.');
    }

    const adminUser: User = {
      id: firebaseUser?.uid || currentUser?.id || `user_admin_${Date.now()}`,
      organizationId: '',
      firstName: adminInfo.firstName,
      lastName: adminInfo.lastName,
      name: `${adminInfo.firstName} ${adminInfo.lastName}`.trim(),
      email: adminInfo.email,
      avatar: firebaseUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(adminInfo.firstName + ' ' + adminInfo.lastName)}&background=0f172a&color=fff`,
      roleIds: ['role_super_admin'],
      primaryRoleId: 'role_super_admin',
      accountStatus: 'active',
      emailVerified: true,
      dateJoined: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = await organizationService.initializeOrganization(
      orgData, 
      adminUser, 
      initialDepts, 
      initialPositions
    );

    setCurrentUser({ ...adminUser, organizationId: res.organization.id });
    setOrganization(res.organization);
    setRoles(res.roles);
    setSystemConfig({
      initialized: true,
      organizationId: res.organization.id,
      superAdminId: adminUser.id,
      setupCompletedAt: new Date().toISOString()
    });

    await auditService.logEvent(
      res.organization.id,
      adminUser,
      'bootstrap_organization',
      'organization',
      res.organization.id,
      res.organization.name,
      { initialDeptsCount: initialDepts.length, initialPositionsCount: initialPositions.length }
    );

    await refreshOrgData();
  };

  const saveSetupOrganization = async (data: {
    name: string;
    logoUrl?: string;
    companyEmail?: string;
    contactNumber?: string;
    officeAddress?: string;
    description?: string;
    timezone: string;
  }): Promise<{ organization: Organization; systemConfig: SystemConfig }> => {
    const actorId = firebaseUser?.uid || currentUser?.id;
    if (!actorId) {
      throw new Error('Please sign in with an authorized administrator account before saving to Firestore.');
    }

    const res = await organizationService.saveOrganizationSection({
      orgId: organization?.id || systemConfig.organizationId,
      actorId,
      data,
      existingConfig: systemConfig
    });

    setOrganization(res.organization);
    setSystemConfig(res.systemConfig);
    if (res.roles.length > 0) setRoles(res.roles);

    if (currentUser) {
      auditService.logEvent(
        res.organization.id,
        currentUser,
        'save_setup_organization',
        'organization',
        res.organization.id,
        res.organization.name
      );
    }

    return { organization: res.organization, systemConfig: res.systemConfig };
  };

  const saveSetupSuperAdmin = async (profile: {
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<{ superAdminUser: User; organization: Organization; systemConfig: SystemConfig }> => {
    if (!firebaseUser) {
      throw new Error('Please sign in with your Super Administrator Email & Password account first.');
    }

    const res = await organizationService.saveSuperAdminSection({
      orgId: organization?.id || systemConfig.organizationId,
      fbUser: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified
      },
      profile,
      existingConfig: systemConfig
    });

    setCurrentUser(res.superAdminUser);
    setOrganization(res.organization);
    setSystemConfig(res.systemConfig);
    if (res.roles.length > 0) setRoles(res.roles);
    setAllUsers((prev) => {
      const exists = prev.some((u) => u.id === res.superAdminUser.id);
      return exists ? prev.map((u) => (u.id === res.superAdminUser.id ? res.superAdminUser : u)) : [res.superAdminUser, ...prev];
    });

    auditService.logEvent(
      res.organization.id,
      res.superAdminUser,
      'save_setup_super_admin',
      'user',
      res.superAdminUser.id,
      res.superAdminUser.email
    );

    return {
      superAdminUser: res.superAdminUser,
      organization: res.organization,
      systemConfig: res.systemConfig
    };
  };

  const uploadOrganizationLogo = async (
    orgId: string,
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<string> => {
    return organizationService.uploadOrganizationLogo(orgId, file, onProgress);
  };

  const updateSetupProgress = async (updates: Partial<SystemConfig>): Promise<SystemConfig> => {
    const updated = await organizationService.updateSetupProgress(
      organization?.id || systemConfig.organizationId,
      updates
    );
    setSystemConfig(updated);
    return updated;
  };

  const syncSectionCompletion = async (
    orgId: string,
    section: SetupSectionKey,
    isComplete: boolean
  ) => {
    if (systemConfig.initialized) return;
    const completedSet = new Set<SetupSectionKey>(systemConfig.completedSections || []);
    if (isComplete) completedSet.add(section);
    else completedSet.delete(section);
    const nextState: SectionSaveState = isComplete ? 'completed' : 'in_progress';
    try {
      const updated = await organizationService.updateSetupProgress(orgId, {
        organizationId: orgId,
        setupStatus: 'in_progress',
        currentSection: section,
        completedSections: Array.from(completedSet),
        sectionStatuses: {
          ...(systemConfig.sectionStatuses || {}),
          [section]: nextState
        }
      });
      setSystemConfig(updated);
    } catch {
      // Non-blocking progress sync; primary entity write already succeeded
    }
  };

  const launchOrganization = async (): Promise<void> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId) {
      throw new Error('Please configure Organization Information before launching.');
    }
    if (!currentUser) {
      throw new Error('An authenticated Super Administrator session is required to launch.');
    }

    const res = await organizationService.launchOrganization(orgId, currentUser);
    setOrganization(res.organization);
    setSystemConfig(res.systemConfig);
    setCurrentUser(res.superAdmin);

    await auditService.logEvent(
      res.organization.id,
      res.superAdmin,
      'launch_organization',
      'organization',
      res.organization.id,
      res.organization.name
    );

    await refreshOrgData();
    showToast('success', `${res.organization.name} is now live.`);
  };

  const createDepartment = async (data: Partial<Department>): Promise<Department> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId) throw new Error('Please save Organization Information or Super Admin first so an organization ID exists.');
    const newDept = await organizationService.createDepartment(orgId, data);
    const nextDepts = [...departments, newDept];
    setDepartments(nextDepts);
    await syncSectionCompletion(orgId, 'departments', nextDepts.some((d) => d.status === 'active'));

    if (currentUser) {
      auditService.logEvent(orgId, currentUser, 'create_department', 'department', newDept.id, newDept.name);
    }
    showToast('success', `Department "${newDept.name}" saved.`);
    return newDept;
  };

  const updateDepartment = async (deptId: string, updates: Partial<Department>): Promise<void> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId) return;
    await organizationService.updateDepartment(orgId, deptId, updates);
    const nextDepts = departments.map(d => d.id === deptId ? { ...d, ...updates } : d);
    setDepartments(nextDepts);
    await syncSectionCompletion(orgId, 'departments', nextDepts.some((d) => d.status === 'active'));

    if (currentUser) {
      auditService.logEvent(orgId, currentUser, 'update_department', 'department', deptId, updates.name || deptId, updates);
    }
    showToast('success', 'Department updated.');
  };

  const deleteDepartment = async (deptId: string): Promise<void> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId) return;
    const target = departments.find((d) => d.id === deptId);
    await organizationService.deleteDepartment(orgId, deptId);
    const nextDepts = departments.filter((d) => d.id !== deptId);
    setDepartments(nextDepts);
    await syncSectionCompletion(orgId, 'departments', nextDepts.some((d) => d.status === 'active'));

    if (currentUser) {
      auditService.logEvent(orgId, currentUser, 'delete_department', 'department', deptId, target?.name || deptId);
    }
    showToast('info', `Department "${target?.name || deptId}" removed.`);
  };

  const createPosition = async (data: Partial<Position>): Promise<Position> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId) throw new Error('Please save Organization Information or Super Admin first so an organization ID exists.');
    const newPos = await organizationService.createPosition(orgId, data);
    const nextPos = [...positions, newPos];
    setPositions(nextPos);
    await syncSectionCompletion(orgId, 'positions', nextPos.some((p) => p.status === 'active'));

    if (currentUser) {
      auditService.logEvent(orgId, currentUser, 'create_position', 'position', newPos.id, newPos.title);
    }
    showToast('success', `Position "${newPos.title}" saved.`);
    return newPos;
  };

  const updatePosition = async (posId: string, updates: Partial<Position>): Promise<void> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId) return;
    if (updates.parentPositionId) {
      const isCycle = organizationService.detectReportingCycle(positions, posId, updates.parentPositionId);
      if (isCycle) {
        throw new Error('Circular reporting detected! A position cannot report to itself or to any of its subordinate positions.');
      }
    }
    await organizationService.updatePosition(orgId, posId, updates);
    const nextPos = positions.map(p => p.id === posId ? { ...p, ...updates } : p);
    setPositions(nextPos);
    await syncSectionCompletion(orgId, 'positions', nextPos.some((p) => p.status === 'active'));

    if (currentUser) {
      auditService.logEvent(orgId, currentUser, 'update_position', 'position', posId, updates.title || posId, updates);
    }
    showToast('success', 'Position updated.');
  };

  const deletePosition = async (posId: string): Promise<void> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId) return;
    const target = positions.find((p) => p.id === posId);
    await organizationService.deletePosition(orgId, posId);
    const nextPos = positions.filter((p) => p.id !== posId);
    setPositions(nextPos);
    await syncSectionCompletion(orgId, 'positions', nextPos.some((p) => p.status === 'active'));

    if (currentUser) {
      auditService.logEvent(orgId, currentUser, 'delete_position', 'position', posId, target?.title || posId);
    }
    showToast('info', `Position "${target?.title || posId}" removed.`);
  };

  const createRole = async (data: Partial<Role>): Promise<Role> => {
    if (!organization) throw new Error('Organization not initialized');
    const newRole = await roleService.createRole(organization.id, data);
    setRoles(prev => [...prev, newRole]);

    if (currentUser) {
      auditService.logEvent(organization.id, currentUser, 'create_role', 'role', newRole.id, newRole.name);
    }
    showToast('success', `Role "${newRole.name}" created.`);
    return newRole;
  };

  const updateRole = async (roleId: string, updates: Partial<Role>): Promise<void> => {
    if (!organization) return;
    await roleService.updateRole(organization.id, roleId, updates);
    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, ...updates } : r));

    if (currentUser) {
      auditService.logEvent(organization.id, currentUser, 'update_role', 'role', roleId, updates.name || roleId, updates);
    }
  };

  const deleteRole = async (roleId: string): Promise<void> => {
    if (!organization) return;
    await roleService.deleteRole(organization.id, roleId);
    setRoles(prev => prev.filter(r => r.id !== roleId));

    if (currentUser) {
      auditService.logEvent(organization.id, currentUser, 'delete_role', 'role', roleId, roleId);
    }
    showToast('success', 'Role deleted.');
  };

  const inviteEmployee = async (data: {
    email: string;
    firstName?: string;
    lastName?: string;
    departmentId?: string | null;
    positionId?: string | null;
    roleIds: string[];
    expirationDays?: number;
    allowDuplicate?: boolean;
  }): Promise<InvitationDeliveryResponse> => {
    if (!organization || !currentUser) throw new Error('Unauthorized');
    try {
      const result = await userService.createAndSendInvitation(
        organization.id,
        data,
        getGmailAccessToken()
      );
      if (result?.invitation?.id) {
        const nextInv = result.invitation;
        setInvitations((prev) => [
          nextInv,
          ...(prev || []).filter(
            (item): item is Invitation => Boolean(item && item.id) && item.id !== nextInv.id
          )
        ]);
        auditService.logEvent(
          organization.id,
          currentUser,
          'invite_user',
          'invitation',
          nextInv.id,
          data.email,
          {
            provider: result.deliveryResult?.provider,
            messageId: result.deliveryResult?.messageId,
            roleIds: data.roleIds
          }
        );
      }
      showToast(
        'success',
        result.emailDelivered
          ? `Invitation sent via ${result.deliveryResult?.provider === 'gmail_oauth' ? 'Gmail' : 'email'} for ${data.email}.`
          : `Invitation code generated for ${data.email}. Copy and share it securely.`
      );
      return result;
    } catch (err: unknown) {
      if (err instanceof InvitationApiError && err.invitation?.id) {
        const failedInv = err.invitation;
        setInvitations((prev) => [
          failedInv,
          ...(prev || []).filter(
            (item): item is Invitation => Boolean(item && item.id) && item.id !== failedInv.id
          )
        ]);
        auditService.logEvent(
          organization.id,
          currentUser,
          'invite_user_delivery_failed',
          'invitation',
          failedInv.id,
          data.email,
          { errorCode: err.errorCode, errorMessage: err.message }
        );
      }
      throw err;
    }
  };

  const resendInvitation = async (invitationId: string): Promise<InvitationDeliveryResponse> => {
    if (!organization || !currentUser) throw new Error('Unauthorized');
    try {
      const result = await userService.resendInvitation(
        organization.id,
        invitationId,
        getGmailAccessToken()
      );
      if (result?.invitation?.id) {
        const nextInv = result.invitation;
        setInvitations((prev) =>
          (prev || [])
            .filter((item): item is Invitation => Boolean(item && item.id))
            .map((item) => (item.id === nextInv.id ? nextInv : item))
        );
        auditService.logEvent(
          organization.id,
          currentUser,
          'resend_invitation',
          'invitation',
          nextInv.id,
          nextInv.email,
          {
            provider: result.deliveryResult?.provider || 'in_app',
            messageId: result.deliveryResult?.messageId
          }
        );
        showToast(
          'success',
          result.emailDelivered
            ? `Resent invitation email to ${nextInv.email}.`
            : `Generated a fresh invitation code for ${nextInv.email}.`
        );
      }
      return result;
    } catch (err: unknown) {
      if (err instanceof InvitationApiError && err.invitation?.id) {
        const failedInv = err.invitation;
        setInvitations((prev) =>
          (prev || [])
            .filter((item): item is Invitation => Boolean(item && item.id))
            .map((item) => (item.id === failedInv.id ? failedInv : item))
        );
      }
      throw err;
    }
  };

  const revokeInvitation = async (invitationId: string): Promise<Invitation> => {
    if (!organization || !currentUser) throw new Error('Unauthorized');
    const updated = await userService.revokeInvitation(organization.id, invitationId);
    if (updated?.id) {
      setInvitations((prev) =>
        (prev || [])
          .filter((item): item is Invitation => Boolean(item && item.id))
          .map((item) => (item.id === updated.id ? updated : item))
      );
      auditService.logEvent(
        organization.id,
        currentUser,
        'revoke_invitation',
        'invitation',
        updated.id,
        updated.email
      );
      showToast('info', `Revoked invitation for ${updated.email}.`);
    }
    return updated;
  };

  const suspendUser = async (userId: string): Promise<void> => {
    if (!organization || !currentUser) return;
    await userService.suspendUser(userId);
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, accountStatus: 'suspended' } : u));
    auditService.logEvent(organization.id, currentUser, 'suspend_user', 'user', userId, userId);
    showToast('info', 'User account suspended.');
  };

  const reactivateUser = async (userId: string): Promise<void> => {
    if (!organization || !currentUser) return;
    await userService.reactivateUser(userId);
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, accountStatus: 'active' } : u));
    auditService.logEvent(organization.id, currentUser, 'reactivate_user', 'user', userId, userId);
    showToast('success', 'User account reactivated.');
  };

  const updateUserAssignments = async (userId: string, updates: Partial<User>): Promise<void> => {
    if (!organization || !currentUser) return;
    await userService.updateUser(userId, updates);
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    if (currentUser.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
    }
    auditService.logEvent(organization.id, currentUser, 'update_user_assignment', 'user', userId, updates.name || userId, updates);
    showToast('success', 'User assignments updated.');
  };

  const updateOrganizationSettings = async (updates: Partial<Organization>): Promise<void> => {
    if (!organization || !currentUser) return;
    await organizationService.updateOrganization(organization.id, updates);
    setOrganization(prev => prev ? { ...prev, ...updates } : null);
    auditService.logEvent(organization.id, currentUser, 'update_organization', 'organization', organization.id, organization.name, updates);
    showToast('success', 'Organization settings saved.');
  };

  const updateAuthPolicy = async (updates: {
    registrationPolicy: RegistrationPolicy;
    requireEmailVerification: boolean;
    requireAdminApproval: boolean;
  }): Promise<AuthPolicyState> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId || !currentUser) throw new Error('Organization not initialized.');
    const nextPolicy = await userService.updateAuthPolicy(orgId, updates);
    setAuthPolicy(nextPolicy);
    setOrganization((prev) =>
      prev
        ? {
            ...prev,
            registrationPolicy: nextPolicy.registrationPolicy,
            allowPublicRegistration: nextPolicy.registrationPolicy === 'public_registration',
            requireEmailVerification: nextPolicy.requireEmailVerification,
            requireAdminApproval: nextPolicy.requireAdminApproval
          }
        : null
    );
    setSystemConfig((prev) => ({
      ...prev,
      registrationPolicy: nextPolicy.registrationPolicy,
      requireEmailVerification: nextPolicy.requireEmailVerification,
      requireAdminApproval: nextPolicy.requireAdminApproval
    }));
    auditService.logEvent(
      orgId,
      currentUser,
      'update_auth_policy',
      'organization',
      orgId,
      organization?.name || orgId,
      updates
    );
    showToast('success', 'Authentication & registration policy updated.');
    return nextPolicy;
  };

  const adminCreateUserAccount = async (payload: {
    firstName: string;
    lastName: string;
    email: string;
    employeeId?: string | null;
    departmentId?: string | null;
    positionId?: string | null;
    roleIds: string[];
    temporaryPassword?: string;
  }): Promise<{ user: User; initialPassword?: string }> => {
    const orgId = organization?.id || systemConfig.organizationId;
    if (!orgId || !currentUser) throw new Error('Organization not initialized.');
    const res = await userService.adminCreateUserAccount(orgId, payload);
    setAllUsers((prev) => [res.user, ...prev.filter((u) => u.id !== res.user.id)]);
    auditService.logEvent(
      orgId,
      currentUser,
      'admin_create_user',
      'user',
      res.user.id,
      res.user.email,
      { roleIds: payload.roleIds }
    );
    showToast('success', `Account created for ${res.user.email}.`);
    return { user: res.user, initialPassword: res.initialPassword };
  };

  const approveRegistrationRequest = async (
    userId: string,
    assignments?: {
      departmentId?: string | null;
      positionId?: string | null;
      managerId?: string | null;
      roleIds?: string[];
    }
  ): Promise<void> => {
    if (!organization || !currentUser) return;
    const target = allUsers.find((u) => u.id === userId);
    const nowIso = new Date().toISOString();

    const nextRoleIds =
      assignments?.roleIds && assignments.roleIds.length > 0
        ? assignments.roleIds
        : target?.roleIds && target.roleIds.length > 0
        ? target.roleIds
        : ['role_member'];

    if (nextRoleIds.includes('role_super_admin') && !isSuperAdmin) {
      throw new Error('Only a Super Administrator can assign the Super Administrator role.');
    }

    const updates: Partial<User> = {
      accountStatus: 'active',
      departmentId: assignments?.departmentId !== undefined ? assignments.departmentId : target?.departmentId || null,
      positionId: assignments?.positionId !== undefined ? assignments.positionId : target?.positionId || null,
      managerId: assignments?.managerId !== undefined ? assignments.managerId : target?.managerId || null,
      roleIds: nextRoleIds,
      primaryRoleId: nextRoleIds[0] || 'role_member',
      rejectionReason: null,
      reviewedBy: currentUser.id,
      reviewedAt: nowIso
    };

    await userService.updateUser(userId, updates);
    await userService.updateRegistrationRequestStatus(userId, {
      status: 'approved',
      rejectionReason: null,
      reviewedBy: currentUser.id,
      reviewedAt: nowIso
    });

    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates, updatedAt: nowIso } : u))
    );
    auditService.logEvent(
      organization.id,
      currentUser,
      'approve_registration',
      'user',
      userId,
      target?.email || userId,
      updates
    );
    showToast('success', `${target?.name || 'User'} approved and granted workspace access.`);
  };

  const approvePendingUser = async (userId: string): Promise<void> => {
    await approveRegistrationRequest(userId);
  };

  const rejectRegistrationRequest = async (userId: string, reason?: string): Promise<void> => {
    if (!organization || !currentUser) return;
    const target = allUsers.find((u) => u.id === userId);
    if (userId === currentUser.id || (target?.roleIds || []).includes('role_super_admin')) {
      throw new Error('You cannot reject this administrator account.');
    }
    const nowIso = new Date().toISOString();
    const updates: Partial<User> = {
      accountStatus: 'rejected',
      rejectionReason: reason?.trim() || null,
      reviewedBy: currentUser.id,
      reviewedAt: nowIso
    };
    await userService.updateUser(userId, updates);
    await userService.updateRegistrationRequestStatus(userId, {
      status: 'rejected',
      rejectionReason: reason?.trim() || null,
      reviewedBy: currentUser.id,
      reviewedAt: nowIso
    });
    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates, updatedAt: nowIso } : u))
    );
    auditService.logEvent(
      organization.id,
      currentUser,
      'reject_registration',
      'user',
      userId,
      target?.email || userId,
      { reason: updates.rejectionReason }
    );
    showToast('info', `Declined registration request for ${target?.name || target?.email || 'user'}.`);
  };

  const archiveUserAccount = async (userId: string): Promise<void> => {
    if (!organization || !currentUser) return;
    const target = allUsers.find((u) => u.id === userId);
    if (userId === currentUser.id || (target?.roleIds || []).includes('role_super_admin')) {
      throw new Error('You cannot archive this administrator account.');
    }
    const nowIso = new Date().toISOString();
    const updates: Partial<User> = {
      accountStatus: 'archived',
      reviewedBy: currentUser.id,
      reviewedAt: nowIso
    };
    await userService.updateUser(userId, updates);
    await userService.updateRegistrationRequestStatus(userId, {
      status: 'archived',
      reviewedBy: currentUser.id,
      reviewedAt: nowIso
    });
    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates, updatedAt: nowIso } : u))
    );
    auditService.logEvent(
      organization.id,
      currentUser,
      'archive_user',
      'user',
      userId,
      target?.email || userId
    );
    showToast('info', `${target?.name || 'User'} account archived.`);
  };

  const deleteUserAccount = async (userId: string): Promise<void> => {
    if (!organization || !currentUser) return;
    const target = allUsers.find((u) => u.id === userId);
    if (userId === currentUser.id || (target?.roleIds || []).includes('role_super_admin')) {
      throw new Error('You cannot delete this administrator account.');
    }
    await userService.deleteUserProfile(userId);
    setAllUsers((prev) => prev.filter((u) => u.id !== userId));
    setRegistrationRequests((prev) => prev.filter((r) => r.userId !== userId));
    auditService.logEvent(
      organization.id,
      currentUser,
      'delete_user',
      'user',
      userId,
      target?.email || userId
    );
    showToast('info', `Removed workspace profile for ${target?.name || target?.email || userId}.`);
  };

  const resolvePasswordRecoveryRequest = async (
    requestId: string,
    updates: {
      status: 'approved' | 'resolved' | 'dismissed';
      resolutionNote?: string | null;
    }
  ): Promise<void> => {
    if (!organization || !currentUser) return;
    const target = passwordRecoveryRequests.find((r) => r.id === requestId);
    const nowIso = new Date().toISOString();
    await userService.resolvePasswordRecoveryRequest(requestId, {
      status: updates.status,
      resolutionNote: updates.resolutionNote,
      resolvedBy: currentUser.id,
      resolvedByName: currentUser.name
    });
    setPasswordRecoveryRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: updates.status,
              resolutionNote: updates.resolutionNote || null,
              resolvedBy: currentUser.id,
              resolvedByName: currentUser.name,
              resolvedAt: nowIso,
              updatedAt: nowIso
            }
          : r
      )
    );
    auditService.logEvent(
      organization.id,
      currentUser,
      `password_recovery_${updates.status}`,
      'password_recovery',
      requestId,
      target?.email || requestId,
      { resolutionNote: updates.resolutionNote || null }
    );
    showToast('success', `Password recovery request marked as ${updates.status}.`);
  };

  // Derived active project
  const activeProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find(p => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const unreadNotificationsCount = useMemo(() => {
    if (!currentUser) return 0;
    return notifications.filter(n => n.recipientId === currentUser.id && !n.isRead).length;
  }, [notifications, currentUser]);

  // Activity logger helper -> persisted to Firestore
  const logActivity = useCallback(async (
    projectId: string, 
    action: string, 
    targetType: ActivityItem['targetType'], 
    targetId: string, 
    targetTitle: string, 
    details?: string
  ) => {
    if (!currentUser || !firebaseUser) return;
    const newAct: ActivityItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      userId: currentUser.id,
      action,
      targetType,
      targetId,
      targetTitle,
      createdAt: new Date().toISOString(),
      details
    };
    await activityService.logActivity(newAct);
  }, [currentUser, firebaseUser]);

  // Notification helper -> persisted to Firestore
  const createNotification = useCallback(async (
    recipientId: string,
    projectId: string,
    targetType: NotificationItem['targetType'],
    targetId: string,
    type: NotificationItem['type'],
    title: string,
    message: string
  ) => {
    if (!currentUser || !firebaseUser || !recipientId || recipientId === currentUser.id) return;
    try {
      await notificationService.createNotification({
        recipientId,
        projectId,
        actorId: currentUser.id,
        targetType,
        targetId,
        type,
        title,
        message,
        isRead: false
      });
    } catch (err) {
      console.warn('Notification dispatch failed:', err);
    }
  }, [currentUser, firebaseUser]);

  // Project Actions
  const createProject = async (data: Partial<Project>): Promise<Project> => {
    if (!currentUser || !firebaseUser) throw new Error('Authentication required.');
    if (!hasPermission('create_projects') && !isAdmin && !isSuperAdmin) {
      const msg = 'You do not have permission to create projects.';
      showToast('error', msg);
      throw new Error(msg);
    }

    const orgId = organization?.id || systemConfig.organizationId || currentUser.organizationId || 'org_mars_default';
    const newId = `proj_${Date.now()}`;
    const now = new Date().toISOString();

    const newProjData: Partial<Project> = {
      id: newId,
      organizationId: orgId,
      name: data.name || 'Untitled Project',
      description: data.description || '',
      departmentId: data.departmentId ?? currentUser.departmentId ?? null,
      status: data.status || 'active',
      visibility: data.visibility || 'public',
      color: data.color || '#0284c7',
      createdAt: now,
      updatedAt: now,
      targetDate: data.targetDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      category: data.category || 'Product Engineering'
    };

    try {
      const created = await projectService.createProject(newProjData, currentUser.id);
      await logActivity(created.id, 'created_project', 'project', created.id, created.name, 'Created new project workspace');
      showToast('success', `Project "${created.name}" created.`);
      return created;
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to create project in Firestore.');
      throw err;
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>): Promise<void> => {
    const project = projects.find(p => p.id === id);
    if (!project || !canManageProject(project)) {
      const msg = 'You do not have permission to modify this project.';
      showToast('error', msg);
      throw new Error(msg);
    }
    try {
      await projectService.updateProject(id, updates);
      await logActivity(id, 'updated_project', 'project', id, updates.name || project.name, 'Updated project settings');
      showToast('success', 'Project updated.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update project.');
      throw err;
    }
  };

  const archiveProject = async (id: string): Promise<void> => {
    await updateProject(id, { status: 'archived' });
  };

  const addProjectMember = async (projectId: string, userId: string, role: ProjectMember['role']): Promise<void> => {
    const project = projects.find(p => p.id === projectId);
    if (!project || (!canManageProject(project) && !hasPermission('manage_project_members'))) {
      const msg = 'You do not have permission to manage project members.';
      showToast('error', msg);
      throw new Error(msg);
    }
    try {
      await projectService.addProjectMember(projectId, userId, role);
      const targetUser = allUsers.find(u => u.id === userId);
      await logActivity(projectId, 'added_member', 'project', projectId, project.name, `Added ${targetUser?.name || 'member'} as ${role.replace('_', ' ')}`);
      await createNotification(userId, projectId, 'task', projectId, 'assigned', 'Added to Project', `${currentUser?.name || 'Admin'} added you to project "${project.name}".`);
      showToast('success', `Added ${targetUser?.name || 'member'} to project.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to add project member.');
      throw err;
    }
  };

  const removeProjectMember = async (projectId: string, userId: string): Promise<void> => {
    const project = projects.find(p => p.id === projectId);
    if (!project || (!canManageProject(project) && !hasPermission('manage_project_members'))) {
      const msg = 'You do not have permission to remove project members.';
      showToast('error', msg);
      throw new Error(msg);
    }
    if (project.ownerId === userId) {
      const msg = 'Cannot remove the project owner.';
      showToast('error', msg);
      throw new Error(msg);
    }
    try {
      await projectService.removeProjectMember(projectId, userId);
      const targetUser = allUsers.find(u => u.id === userId);
      await logActivity(projectId, 'removed_member', 'project', projectId, project.name, `Removed ${targetUser?.name || 'member'} from project`);
      showToast('info', `Removed ${targetUser?.name || 'member'} from project.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to remove project member.');
      throw err;
    }
  };

  // Task Actions
  const createTask = async (data: Partial<Task>): Promise<Task> => {
    if (!currentUser || !firebaseUser) throw new Error('Authentication required.');
    if (!hasPermission('create_tasks') && !isAdmin && !isSuperAdmin) {
      const msg = 'You do not have permission to create tasks.';
      showToast('error', msg);
      throw new Error(msg);
    }

    const targetProjId = data.projectId || activeProjectId || projects[0]?.id;
    if (!targetProjId || !projects.some(p => p.id === targetProjId)) {
      const msg = 'Please select or create a valid project before creating a task.';
      showToast('error', msg);
      throw new Error(msg);
    }

    try {
      const created = await taskService.createTask({ ...data, projectId: targetProjId }, currentUser.id);
      await logActivity(targetProjId, 'created_task', 'task', created.id, created.title, `Created task "${created.title}" (${created.priority} priority)`);

      await Promise.all(
        created.assignedUserIds.map((uid) =>
          createNotification(
            uid,
            targetProjId,
            'task',
            created.id,
            'assigned',
            'New Task Assigned',
            `${currentUser.name} assigned you to "${created.title}".`
          )
        )
      );

      showToast('success', `Task "${created.title}" created.`);
      return created;
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to create task.');
      throw err;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask || !currentUser) return;

    const isAssignee = targetTask.assignedUserIds.includes(currentUser.id);
    if (!hasPermission('edit_tasks') && !isAssignee && targetTask.createdBy !== currentUser.id && !isAdmin) {
      const msg = 'You do not have permission to edit this task.';
      showToast('error', msg);
      throw new Error(msg);
    }

    try {
      await taskService.updateTask(targetTask.projectId, taskId, updates);
      if (updates.assignedUserIds) {
        const newlyAdded = updates.assignedUserIds.filter(uid => !targetTask.assignedUserIds.includes(uid));
        await Promise.all(
          newlyAdded.map((uid) =>
            createNotification(
              uid,
              targetTask.projectId,
              'task',
              targetTask.id,
              'assigned',
              'Task Assigned',
              `${currentUser.name} assigned you to "${updates.title || targetTask.title}".`
            )
          )
        );
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update task.');
      throw err;
    }
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask || !currentUser) return;

    if (!hasPermission('delete_tasks') && targetTask.createdBy !== currentUser.id && !isAdmin && !isSuperAdmin) {
      const msg = 'You do not have permission to delete this task.';
      showToast('error', msg);
      throw new Error(msg);
    }

    try {
      await taskService.deleteTask(targetTask.projectId, taskId, targetTask.assignedUserIds);
      await logActivity(targetTask.projectId, 'deleted_task', 'task', taskId, targetTask.title, `Deleted task "${targetTask.title}"`);
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      showToast('info', `Task "${targetTask.title}" deleted.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete task.');
      throw err;
    }
  };

  const startTask = async (taskId: string): Promise<void> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      await taskService.startTask(task.projectId, taskId);
      await logActivity(task.projectId, 'started_task', 'task', task.id, task.title, `Started work on "${task.title}"`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to start task.');
      throw err;
    }
  };

  const submitTaskForApproval = async (taskId: string, remarks: string, attachments?: Attachment[]): Promise<void> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !currentUser) return;
    const round = (task.approvalHistory?.length || 0) + 1;

    try {
      await taskService.submitForApproval(task.projectId, taskId, currentUser.id, remarks, attachments || []);
      await logActivity(
        task.projectId,
        'submitted_for_approval',
        'approval',
        task.id,
        task.title,
        `Submitted Round ${round} for review: "${remarks}"`
      );

      // Notify project approvers/project_admins, project owner, and organization admins
      const proj = projects.find(p => p.id === task.projectId);
      const projMembers = membersByProject[task.projectId] || [];
      const reviewerIds = new Set<string>();

      if (proj?.ownerId) reviewerIds.add(proj.ownerId);
      projMembers.forEach((m) => {
        if (m.role === 'approver' || m.role === 'project_admin') {
          reviewerIds.add(m.userId);
        }
      });
      allUsers.forEach((u) => {
        if (roleService.hasPermission(u, roles, 'approve_tasks')) {
          reviewerIds.add(u.id);
        }
      });

      await Promise.all(
        Array.from(reviewerIds).map((uid) =>
          createNotification(
            uid,
            task.projectId,
            'approval',
            task.id,
            'submitted_approval',
            'Task Awaiting Approval',
            `${currentUser.name} submitted Round ${round} of "${task.title}" for review.`
          )
        )
      );

      showToast('success', `Submitted Round ${round} for approval.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to submit task for approval.');
      throw err;
    }
  };

  const requestTaskRevision = async (taskId: string, notes: string): Promise<void> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !currentUser) return;

    if (!isApproverForProject(task.projectId)) {
      const msg = 'Only authorized approvers or project admins can request revisions.';
      showToast('error', msg);
      throw new Error(msg);
    }

    try {
      await taskService.requestRevision(task.projectId, taskId, currentUser.id, notes);
      await logActivity(task.projectId, 'requested_revision', 'approval', task.id, task.title, `Revision requested: "${notes}"`);

      const notifyTargets = new Set<string>([...task.assignedUserIds, task.createdBy]);
      await Promise.all(
        Array.from(notifyTargets).map((uid) =>
          createNotification(
            uid,
            task.projectId,
            'approval',
            task.id,
            'revision_requested',
            'Revisions Requested',
            `${currentUser.name} requested revisions on "${task.title}": ${notes}`
          )
        )
      );

      showToast('info', 'Revision request sent to assignee.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to request task revision.');
      throw err;
    }
  };

  const approveTask = async (taskId: string): Promise<void> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !currentUser) return;

    if (!isApproverForProject(task.projectId)) {
      const msg = 'Only authorized approvers or project admins can approve and complete tasks.';
      showToast('error', msg);
      throw new Error(msg);
    }

    try {
      await taskService.approveTask(task.projectId, taskId, currentUser.id);
      await logActivity(task.projectId, 'approved_task', 'approval', task.id, task.title, `Approved & completed "${task.title}"`);

      const notifyTargets = new Set<string>([...task.assignedUserIds, task.createdBy]);
      await Promise.all(
        Array.from(notifyTargets).map((uid) =>
          createNotification(
            uid,
            task.projectId,
            'approval',
            task.id,
            'approved',
            'Task Approved!',
            `${currentUser.name} approved "${task.title}".`
          )
        )
      );

      showToast('success', `Task "${task.title}" approved & completed.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to approve task.');
      throw err;
    }
  };

  const moveTaskStatus = async (taskId: string, newStatus: TaskStatus): Promise<void> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus || !currentUser) return;

    // Permission checks on protected workflow transitions
    if ((newStatus === 'completed' || newStatus === 'for_revision') && !isApproverForProject(task.projectId)) {
      const msg = 'Only authorized approvers can move a task directly to Completed or For Revision.';
      showToast('error', msg);
      return;
    }

    const isAssignee = task.assignedUserIds.includes(currentUser.id);
    if (!hasPermission('change_task_status') && !hasPermission('edit_tasks') && !isAssignee && task.createdBy !== currentUser.id && !isAdmin) {
      showToast('error', 'You do not have permission to change task status.');
      return;
    }

    if (newStatus === 'in_progress' && !task.timestamps?.startedAt) {
      await startTask(taskId);
      return;
    }

    if (newStatus === 'completed') {
      await approveTask(taskId);
      return;
    }

    try {
      await taskService.updateTask(task.projectId, taskId, { status: newStatus });
      await logActivity(
        task.projectId,
        'updated_status',
        'task',
        task.id,
        task.title,
        `Moved "${task.title}" to ${newStatus.replace('_', ' ')}`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update task status.');
    }
  };

  // Discussions
  const createDiscussion = async (data: Partial<Discussion>): Promise<Discussion> => {
    if (!currentUser || !firebaseUser) throw new Error('Authentication required.');
    const targetProjId = data.projectId || activeProjectId || projects[0]?.id;
    if (!targetProjId) {
      const msg = 'Please select a valid project before posting.';
      showToast('error', msg);
      throw new Error(msg);
    }

    try {
      const created = await discussionService.createDiscussion({ ...data, projectId: targetProjId }, currentUser.id);
      await logActivity(targetProjId, 'created_discussion', 'discussion', created.id, created.title, `Posted "${created.title}" in ${created.category}`);
      showToast('success', 'Discussion posted.');
      return created;
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to post discussion.');
      throw err;
    }
  };

  const togglePinDiscussion = async (id: string): Promise<void> => {
    const disc = discussions.find(d => d.id === id);
    if (!disc) return;
    try {
      await discussionService.togglePin(disc.projectId, disc.id, disc.pinned);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update pin status.');
    }
  };

  const deleteDiscussion = async (projectId: string, id: string): Promise<void> => {
    try {
      await discussionService.deleteDiscussion(projectId, id);
      showToast('info', 'Discussion deleted.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete discussion.');
    }
  };

  // Parse @mentions in comment text against workspace users
  const extractMentions = useCallback((content: string): string[] => {
    const lower = content.toLowerCase();
    const matchedIds = new Set<string>();
    allUsers.forEach((u) => {
      const fullName = u.name?.toLowerCase();
      const firstName = u.firstName?.toLowerCase();
      const emailHandle = u.email?.split('@')[0]?.toLowerCase();
      if (
        (fullName && lower.includes(`@${fullName}`)) ||
        (firstName && firstName.length > 1 && new RegExp(`@${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(content)) ||
        (emailHandle && lower.includes(`@${emailHandle}`))
      ) {
        matchedIds.add(u.id);
      }
    });
    return Array.from(matchedIds);
  }, [allUsers]);

  // Comments (Unified Engine)
  const addComment = async (data: {
    projectId: string;
    targetType: Comment['targetType'];
    targetId: string;
    content: string;
    parentCommentId?: string | null;
    mentions?: string[];
    attachments?: Attachment[];
  }): Promise<Comment> => {
    if (!currentUser || !firebaseUser) throw new Error('Authentication required.');
    const detectedMentions = Array.from(new Set([...(data.mentions || []), ...extractMentions(data.content)]));
    const commentId = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      const created = await commentService.addComment({
        ...data,
        id: commentId,
        userId: currentUser.id,
        mentions: detectedMentions
      });

      await logActivity(
        data.projectId,
        'added_comment',
        data.targetType,
        data.targetId,
        `Comment on ${data.targetType}`,
        data.content.slice(0, 80)
      );

      // Notify mentioned users
      await Promise.all(
        detectedMentions.map((uid) =>
          createNotification(
            uid,
            data.projectId,
            data.targetType === 'discussion' ? 'discussion' : 'mention',
            data.targetId,
            'mentioned',
            `${currentUser.name} mentioned you`,
            `"${data.content.slice(0, 120)}"`
          )
        )
      );

      // Notify task assignees or discussion author if not already notified via @mention
      if (data.targetType === 'task') {
        const t = tasks.find((item) => item.id === data.targetId);
        if (t) {
          const notifyIds = new Set<string>([...t.assignedUserIds, t.createdBy]);
          await Promise.all(
            Array.from(notifyIds)
              .filter((uid) => !detectedMentions.includes(uid))
              .map((uid) =>
                createNotification(
                  uid,
                  data.projectId,
                  'task',
                  t.id,
                  'commented',
                  `New comment on "${t.title}"`,
                  `${currentUser.name}: ${data.content.slice(0, 120)}`
                )
              )
          );
        }
      } else if (data.targetType === 'discussion') {
        const d = discussions.find((item) => item.id === data.targetId);
        if (d && !detectedMentions.includes(d.authorId)) {
          await createNotification(
            d.authorId,
            data.projectId,
            'discussion',
            d.id,
            'commented',
            `New reply on "${d.title}"`,
            `${currentUser.name}: ${data.content.slice(0, 120)}`
          );
        }
      }

      return created;
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to post comment.');
      throw err;
    }
  };

  const toggleReaction = async (commentId: string, emoji: string): Promise<void> => {
    if (!currentUser) return;
    try {
      await commentService.toggleReaction(commentId, currentUser.id, emoji);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update reaction.');
    }
  };

  const deleteComment = async (commentId: string): Promise<void> => {
    try {
      await commentService.deleteComment(commentId);
      showToast('info', 'Comment removed.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete comment.');
    }
  };

  // Files
  const uploadFile = async (data: {
    projectId: string;
    file?: File | null;
    name?: string;
    folder: string;
    url?: string;
    type?: string;
    size?: string;
    onProgress?: (pct: number) => void;
  }): Promise<ProjectFile> => {
    if (!currentUser || !firebaseUser) throw new Error('Authentication required.');
    const targetProjId = data.projectId || activeProjectId || projects[0]?.id;
    if (!targetProjId) {
      const msg = 'Please select a valid project before uploading a file.';
      showToast('error', msg);
      throw new Error(msg);
    }

    try {
      const uploaded = await fileService.uploadProjectFile({
        ...data,
        projectId: targetProjId,
        uploadedBy: currentUser.id
      });
      await logActivity(targetProjId, 'uploaded_file', 'file', uploaded.id, uploaded.name, `Uploaded "${uploaded.name}" to ${uploaded.folder}`);
      showToast('success', `Uploaded "${uploaded.name}".`);
      return uploaded;
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to upload file.');
      throw err;
    }
  };

  const deleteFile = async (projectId: string, fileId: string, fileUrl?: string): Promise<void> => {
    try {
      await fileService.deleteProjectFile(projectId, fileId, fileUrl);
      await logActivity(projectId, 'deleted_file', 'file', fileId, fileId, 'Removed project file');
      showToast('info', 'File removed.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete file.');
    }
  };

  const downloadFile = async (file: ProjectFile): Promise<void> => {
    if (!file.url || file.url === '#') {
      showToast('info', 'This file record has no attached binary or external URL yet.');
      return;
    }
    await fileService.incrementDownloadCount(file.projectId, file.id);
    const link = document.createElement('a');
    link.href = file.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Events
  const createEvent = async (data: Omit<ScheduleEvent, 'id'>): Promise<ScheduleEvent> => {
    if (!data.projectId) {
      const msg = 'Please select a valid project for this event.';
      showToast('error', msg);
      throw new Error(msg);
    }
    try {
      const created = await scheduleService.createEvent(data);
      await logActivity(created.projectId, 'scheduled_event', 'project', created.id, created.title, `Scheduled "${created.title}" for ${created.date}`);
      showToast('success', `Scheduled "${created.title}".`);
      return created;
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to create schedule event.');
      throw err;
    }
  };

  const deleteEvent = async (projectId: string, eventId: string): Promise<void> => {
    try {
      await scheduleService.deleteEvent(projectId, eventId);
      showToast('info', 'Schedule event removed.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete event.');
    }
  };

  // Notifications
  const markNotificationAsRead = async (id: string): Promise<void> => {
    try {
      await notificationService.markAsRead(id);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to mark notification as read.');
    }
  };

  const markAllNotificationsAsRead = async (): Promise<void> => {
    if (!currentUser) return;
    const unreadIds = notifications
      .filter((n) => n.recipientId === currentUser.id && !n.isRead)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      await notificationService.markAllAsRead(currentUser.id, unreadIds);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to mark all notifications as read.');
    }
  };

  // Project statistics helper
  const getProjectStats = useCallback((projectId: string): ProjectStatistics => {
    const projTasks = tasks.filter(t => t.projectId === projectId);
    const total = projTasks.length;
    const completed = projTasks.filter(t => t.status === 'completed').length;
    const pending = projTasks.filter(t => t.status === 'pending').length;
    const inProgress = projTasks.filter(t => t.status === 'in_progress').length;
    const forRevision = projTasks.filter(t => t.status === 'for_revision').length;
    const forApproval = projTasks.filter(t => t.status === 'for_approval').length;
    
    const today = new Date().toISOString().split('T')[0];
    const overdue = projTasks.filter(t => t.status !== 'completed' && t.dueDate < today).length;

    const completedWithTAT = projTasks.filter(t => t.tatMetrics?.totalCompletionHours !== undefined);
    const avgTAT = completedWithTAT.length > 0 
      ? Math.round(completedWithTAT.reduce((acc, cur) => acc + (cur.tatMetrics?.totalCompletionHours || 0), 0) / completedWithTAT.length) 
      : 0;

    const members = membersByProject[projectId] || [];

    return {
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      inProgressTasks: inProgress,
      forRevisionTasks: forRevision,
      forApprovalTasks: forApproval,
      overdueTasks: overdue,
      totalMembers: members.length,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgTurnaroundHours: avgTAT
    };
  }, [tasks, membersByProject]);

  // Global aggregate stats
  const globalStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const activeTasks = tasks.filter(t => t.status !== 'completed');
    const awaitingApproval = tasks.filter(t => t.status === 'for_approval').length;
    const forRevision = tasks.filter(t => t.status === 'for_revision').length;
    const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.dueDate < today).length;
    const completedThisMonth = tasks.filter(t => t.status === 'completed').length;

    return {
      totalProjects: projects.filter(p => p.status === 'active').length,
      activeTasks: activeTasks.length,
      awaitingApproval,
      forRevision,
      overdueTasks,
      completedThisMonth
    };
  }, [tasks, projects]);

  return (
    <AppContext.Provider
      value={{
        toast,
        showToast,
        dismissToast,

        firebaseUser,
        currentUser,
        isAuthReady,
        isSyncingWorkspace,
        authPolicy,
        signInWithEmail,
        registerWithEmail,
        registerPublicUser,
        completeEmailInvitationRegistration,
        submitPasswordRecoveryRequest,
        resolvePasswordRecoveryRequest,
        changePassword,
        signOut,
        updateOwnProfile,
        updateAuthPolicy,
        adminCreateUserAccount,
        approvePendingUser,
        approveRegistrationRequest,
        rejectRegistrationRequest,
        archiveUserAccount,
        deleteUserAccount,

        systemConfig,
        organization,
        departments,
        positions,
        roles,
        allUsers,
        users: allUsers,
        projectMembers: membersByProject,
        invitations,
        registrationRequests,
        passwordRecoveryRequests,
        auditLogs,
        refreshOrgData,

        isSuperAdmin,
        isAdmin,
        userEffectivePermissions,
        hasPermission,
        isApproverForProject,
        canManageProject,

        bootstrapSystem,
        saveSetupOrganization,
        saveSetupSuperAdmin,
        uploadOrganizationLogo,
        updateSetupProgress,
        launchOrganization,
        createDepartment,
        updateDepartment,
        deleteDepartment,
        createPosition,
        updatePosition,
        deletePosition,
        createRole,
        updateRole,
        deleteRole,
        inviteEmployee,
        resendInvitation,
        revokeInvitation,
        suspendUser,
        reactivateUser,
        updateUserAssignments,
        updateOrganizationSettings,

        activeView,
        setActiveView,
        settingsTab,
        setSettingsTab,
        openEmailConfiguration,
        activeAdminSection,
        setActiveAdminSection,
        activeProjectId,
        setActiveProjectId,
        activeProjectTab,
        setActiveProjectTab,

        projects,
        activeProject,
        createProject,
        updateProject,
        archiveProject,
        addProjectMember,
        removeProjectMember,

        tasks,
        createTask,
        updateTask,
        deleteTask,
        moveTaskStatus,
        startTask,
        submitTaskForApproval,
        requestTaskRevision,
        approveTask,
        selectedTaskId,
        setSelectedTaskId,

        discussions,
        createDiscussion,
        togglePinDiscussion,
        deleteDiscussion,

        comments,
        addComment,
        toggleReaction,
        deleteComment,

        files,
        uploadFile,
        deleteFile,
        downloadFile,

        events,
        createEvent,
        deleteEvent,

        activities,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,

        isQuickCreateOpen,
        setIsQuickCreateOpen,
        quickCreateType,
        setQuickCreateType,
        searchQuery,
        setSearchQuery,
        isSearchOpen,
        setIsSearchOpen,
        isOrgChartOpen,
        setIsOrgChartOpen,

        getProjectStats,
        globalStats
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
