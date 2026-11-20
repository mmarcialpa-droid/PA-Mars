export type PermissionCategory = 
  | 'user_management'
  | 'project_management'
  | 'task_management'
  | 'approval_management'
  | 'collaboration'
  | 'files'
  | 'reports'
  | 'system_administration';

export type PermissionScope = 'organization' | 'department' | 'project' | 'assigned' | 'own';

export interface PermissionDefinition {
  id: string;
  name: string;
  category: PermissionCategory;
  description: string;
  defaultScope: PermissionScope;
  isSensitive?: boolean;
}

export type UserRole = 'super_admin' | 'project_admin' | 'approver' | 'member' | 'viewer';

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  level: number; // 1 (Super Admin) to 6 (Viewer) or custom
  parentRoleId?: string | null;
  permissions: string[]; // PermissionDefinition ids
  scopes: Record<string, PermissionScope>; // permissionId -> scope
  isSystemRole: boolean;
  isSystem?: boolean; // alias for isSystemRole
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type AccountStatus =
  | 'active'
  | 'suspended'
  | 'invited'
  | 'pending_verification'
  | 'pending_approval'
  | 'rejected'
  | 'archived';

export type RegistrationPolicy =
  | 'invitation_only'
  | 'admin_created'
  | 'public_registration';

export interface AuthPolicyState {
  initialized: boolean;
  organizationId: string | null;
  organizationName?: string | null;
  registrationPolicy: RegistrationPolicy;
  requireEmailVerification: boolean;
  requireAdminApproval: boolean;
}

export interface User {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  employeeId?: string | null;
  avatar: string;
  departmentId?: string | null;
  department?: string; // name
  requestedDepartment?: string | null;
  positionId?: string | null;
  title?: string; // title
  managerId?: string | null;
  roleIds: string[];
  primaryRoleId?: string;
  role?: UserRole;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  invitedTokenHash?: string;
  termsAcceptedAt?: string | null;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  phone?: string;
  bio?: string;
  dateJoined: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationRequest {
  id: string;
  userId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  employeeId?: string | null;
  requestedDepartment?: string | null;
  registrationMethod: 'public_signup' | 'invitation';
  invitedTokenHash?: string | null;
  status: 'pending_approval' | 'approved' | 'rejected' | 'archived';
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordRecoveryRequest {
  id: string;
  organizationId?: string | null;
  email: string;
  employeeId?: string | null;
  userId?: string | null;
  userName?: string | null;
  note?: string | null;
  status: 'pending' | 'approved' | 'resolved' | 'dismissed';
  resolutionNote?: string | null;
  resolvedBy?: string | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  parentDepartmentId?: string | null;
  headUserId?: string | null;
  departmentHeadId?: string | null;
  status: 'active' | 'archived';
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  organizationId: string;
  title: string;
  departmentId?: string | null;
  parentPositionId?: string | null; // Reporting position
  level: number;
  organizationalLevel: number; // 1 = Executive, 2 = Director, 3 = Manager, 4 = Senior, 5 = Associate
  description: string;
  status: 'active' | 'archived';
  assignedEmployeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export type SetupSectionKey =
  | 'organization'
  | 'super_admin'
  | 'departments'
  | 'positions'
  | 'review';

export type SectionSaveState =
  | 'not_started'
  | 'in_progress'
  | 'saved'
  | 'error'
  | 'completed';

export interface Organization {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  companyEmail?: string;
  contactNumber?: string;
  officeAddress?: string;
  timezone: string;
  defaultLanguage: string;
  allowPublicRegistration: boolean;
  registrationPolicy?: RegistrationPolicy;
  requireEmailVerification?: boolean;
  requireAdminApproval?: boolean;
  status: 'active' | 'setup';
  setupStatus?: 'not_started' | 'in_progress' | 'active';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  launchedAt?: string | null;
}

export interface SystemConfig {
  initialized: boolean;
  organizationId: string | null;
  organizationName?: string | null;
  superAdminId: string | null;
  setupCompletedAt?: string | null;
  maintenanceMode?: boolean;
  setupStatus?: 'not_started' | 'in_progress' | 'active';
  registrationPolicy?: RegistrationPolicy;
  requireEmailVerification?: boolean;
  requireAdminApproval?: boolean;
  completedSections?: SetupSectionKey[];
  currentSection?: SetupSectionKey;
  sectionStatuses?: Partial<Record<SetupSectionKey, SectionSaveState>>;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  launchedAt?: string | null;
  schemaVersion?: number;
}

export type InvitationStatus =
  | 'draft'
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'expired'
  | 'accepted'
  | 'revoked';

export interface InvitationSendAttempt {
  attemptAt: string;
  provider: string;
  status: 'sent' | 'failed';
  messageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  recipientName?: string;
  departmentId?: string | null;
  positionId?: string | null;
  roleIds: string[];
  invitedBy: string;
  token?: string;
  tokenHash?: string;
  codeMask?: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
  lastSentAt?: string | null;
  resendCount?: number;
  deliveryProvider?: string | null;
  providerMessageId?: string | null;
  senderEmail?: string | null;
  deliveryNote?: string | null;
  deliveryError?: string | null;
  sendAttempts?: InvitationSendAttempt[];
  redeemedAt?: string | null;
  redeemedBy?: string | null;
  redeemedEmail?: string | null;
}

export interface VerifiedInvitationSummary {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionTitle: string | null;
  roleIds: string[];
  roleNames: string[];
  status: string;
  expiresAt: string;
}

export type EmailProviderId = 'resend' | 'gmail_oauth' | 'smtp';

export interface EmailProviderDiagnostic {
  provider: EmailProviderId;
  label: string;
  description: string;
  configured: boolean;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  senderAddress: string | null;
  statusMessage: string;
}

export interface OrganizationEmailConfig {
  id: 'default';
  organizationId: string;
  activeProvider: EmailProviderId;
  allowFallback: boolean;
  fallbackProvider: EmailProviderId | null;
  senderDisplayName?: string;
  lastDeliveryStatus: 'never' | 'sent' | 'failed';
  lastSuccessfulDeliveryAt?: string | null;
  lastSuccessfulProvider?: string | null;
  lastSuccessfulSender?: string | null;
  lastErrorAt?: string | null;
  lastErrorProvider?: string | null;
  lastErrorMessage?: string | null;
  updatedBy?: string;
  updatedAt: string;
}

export interface EmailDeliveryLog {
  id: string;
  organizationId: string;
  recipientEmail: string;
  subject: string;
  category: 'invitation' | 'test' | 'system';
  relatedInvitationId?: string | null;
  idempotencyKey: string;
  provider: EmailProviderId | 'none';
  fallbackUsed: boolean;
  fallbackFromProvider?: string | null;
  senderEmail?: string | null;
  status: 'sent' | 'failed';
  messageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  retriedFromLogId?: string | null;
  retriedByLogId?: string | null;
  triggeredBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EmailProviderStatus {
  defaultProvider: EmailProviderId;
  activeProvider: EmailProviderId;
  activeProviderConfigured: boolean;
  activeSenderAddress: string | null;
  activeStatusMessage: string;
  allowFallback: boolean;
  fallbackProvider: EmailProviderId | null;
  gmailOAuthSupported: boolean;
  providers: Record<EmailProviderId, EmailProviderDiagnostic>;
  config?: OrganizationEmailConfig;
  logs?: EmailDeliveryLog[];
  // Backwards-compatible flags
  serverProviders: {
    resend: boolean;
    smtp: boolean;
  };
  defaultServerProvider: EmailProviderId | null;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  targetType:
    | 'user'
    | 'department'
    | 'position'
    | 'role'
    | 'permission'
    | 'organization'
    | 'invitation'
    | 'registration_request'
    | 'password_recovery'
    | 'email_config'
    | 'email_log';
  targetId: string;
  targetTitle: string;
  changes?: Record<string, any>;
  details?: any;
  ipAddress?: string;
  timestamp?: string;
  createdAt: string;
}

// -------------------------------------------------------------
// Project & Task entities for empty/clean workspace usage
// -------------------------------------------------------------

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export type ProjectVisibility = 'public' | 'private' | 'department';

export interface ProjectMember {
  userId: string;
  role: string;
  joinedAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  ownerId: string;
  departmentId?: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  color: string;
  createdAt: string;
  updatedAt: string;
  targetDate: string;
  category: string;
}

export type TaskStatus = 
  | 'todo' 
  | 'in_progress' 
  | 'pending' 
  | 'for_revision' 
  | 'for_approval' 
  | 'completed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ApprovalRecord {
  id: string;
  round: number;
  submittedBy: string;
  submittedAt: string;
  designerRemarks: string;
  submissionAttachments: Attachment[];
  status: 'pending' | 'approved' | 'revision_requested';
  reviewedBy?: string;
  reviewedAt?: string;
  revisionNotes?: string;
}

export interface TaskTimestamps {
  createdAt: string;
  startedAt?: string;
  initialSubmittedAt?: string;
  revisionRequestedAt?: string;
  resubmittedAt?: string;
  approvedAt?: string;
  completedAt?: string;
}

export interface TaskTAT {
  creationToStartHours?: number;
  startToFirstSubmissionHours?: number;
  revisionDurationHours?: number;
  approvalTurnaroundHours?: number;
  totalCompletionHours?: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string;
  assignedUserIds: string[];
  dueDate: string;
  subtasks: Subtask[];
  attachments: Attachment[];
  approvalHistory: ApprovalRecord[];
  timestamps: TaskTimestamps;
  tatMetrics?: TaskTAT;
  tags: string[];
}

export interface Discussion {
  id: string;
  projectId: string;
  title: string;
  content: string;
  authorId: string;
  category: 'announcement' | 'discussion' | 'question' | 'update';
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
}

export interface Comment {
  id: string;
  projectId: string;
  targetType: 'task' | 'discussion' | 'file' | 'announcement' | 'approval';
  targetId: string;
  userId: string;
  content: string;
  parentCommentId: string | null;
  mentions: string[];
  attachments: Attachment[];
  reactions: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  folder: string;
  size: string;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  downloadsCount: number;
}

export interface ScheduleEvent {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: 'deadline' | 'milestone' | 'meeting' | 'review';
  date: string;
  time?: string;
  attendeeIds: string[];
}

export interface ActivityItem {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  targetType: 'task' | 'project' | 'discussion' | 'file' | 'approval' | 'comment' | 'announcement';
  targetId: string;
  targetTitle: string;
  createdAt: string;
  details?: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  projectId: string;
  actorId: string;
  targetType: 'task' | 'discussion' | 'file' | 'approval' | 'mention';
  targetId: string;
  type: 'assigned' | 'submitted_approval' | 'revision_requested' | 'approved' | 'commented' | 'mentioned' | 'deadline_soon';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ProjectStatistics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  forRevisionTasks: number;
  forApprovalTasks: number;
  overdueTasks: number;
  totalMembers: number;
  completionPercentage: number;
  avgTurnaroundHours: number;
}
