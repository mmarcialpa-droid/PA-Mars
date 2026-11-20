import { 
  User, 
  Project, 
  ProjectMember, 
  Task, 
  Discussion, 
  Comment, 
  ProjectFile, 
  ScheduleEvent, 
  ActivityItem, 
  NotificationItem,
  Department,
  Position,
  Role,
  Invitation,
  AuditLog,
  Organization,
  SystemConfig
} from '../types';

// Pure, clean application initialization state:
// No mock users, no sample projects, no simulated tasks, no fake comments.
// Only authentic data created by the initialized Super Administrator and team will populate this.

export const INITIAL_USERS: User[] = [];
export const INITIAL_PROJECTS: Project[] = [];
export const INITIAL_PROJECT_MEMBERS: Record<string, ProjectMember[]> = {};
export const INITIAL_TASKS: Task[] = [];
export const INITIAL_DISCUSSIONS: Discussion[] = [];
export const INITIAL_COMMENTS: Comment[] = [];
export const INITIAL_FILES: ProjectFile[] = [];
export const INITIAL_EVENTS: ScheduleEvent[] = [];
export const INITIAL_ACTIVITIES: ActivityItem[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
export const INITIAL_DEPARTMENTS: Department[] = [];
export const INITIAL_POSITIONS: Position[] = [];
export const INITIAL_ROLES: Role[] = [];
export const INITIAL_INVITATIONS: Invitation[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_SYSTEM_CONFIG: SystemConfig = {
  initialized: false,
  organizationId: null,
  organizationName: null,
  superAdminId: null,
  setupCompletedAt: null,
  setupStatus: 'not_started',
  registrationPolicy: 'invitation_only',
  requireEmailVerification: false,
  requireAdminApproval: true,
  completedSections: [],
  currentSection: 'organization',
  sectionStatuses: {
    organization: 'not_started',
    super_admin: 'not_started',
    departments: 'not_started',
    positions: 'not_started',
    review: 'not_started'
  },
  schemaVersion: 2
};
