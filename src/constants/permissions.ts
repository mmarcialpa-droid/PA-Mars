import { PermissionDefinition, Role } from '../types';

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // A. User Management
  { id: 'view_users', name: 'View Users', category: 'user_management', description: 'View user directory and profiles', defaultScope: 'organization' },
  { id: 'create_users', name: 'Create Users', category: 'user_management', description: 'Create employee accounts directly', defaultScope: 'organization', isSensitive: true },
  { id: 'edit_users', name: 'Edit Users', category: 'user_management', description: 'Edit user profiles, positions, and details', defaultScope: 'department', isSensitive: true },
  { id: 'deactivate_users', name: 'Deactivate Users', category: 'user_management', description: 'Suspend or archive user access', defaultScope: 'organization', isSensitive: true },
  { id: 'manage_roles', name: 'Manage User Roles', category: 'user_management', description: 'Assign and change user roles', defaultScope: 'organization', isSensitive: true },
  { id: 'manage_departments', name: 'Manage Departments', category: 'user_management', description: 'Create, edit, and organize departments', defaultScope: 'organization', isSensitive: true },
  { id: 'manage_positions', name: 'Manage Positions', category: 'user_management', description: 'Create and organize organizational reporting positions', defaultScope: 'organization', isSensitive: true },

  // B. Project Management
  { id: 'view_projects', name: 'View Projects', category: 'project_management', description: 'View project workspaces', defaultScope: 'department' },
  { id: 'create_projects', name: 'Create Projects', category: 'project_management', description: 'Initialize new project workspaces', defaultScope: 'department' },
  { id: 'edit_projects', name: 'Edit Projects', category: 'project_management', description: 'Modify project details, status, and deadlines', defaultScope: 'project' },
  { id: 'archive_projects', name: 'Archive Projects', category: 'project_management', description: 'Archive or restore completed projects', defaultScope: 'department' },
  { id: 'delete_projects', name: 'Delete Projects', category: 'project_management', description: 'Permanently remove projects', defaultScope: 'organization', isSensitive: true },
  { id: 'manage_project_members', name: 'Manage Project Members', category: 'project_management', description: 'Add or remove members from projects', defaultScope: 'project' },

  // C. Task Management
  { id: 'view_tasks', name: 'View Tasks', category: 'task_management', description: 'View tasks and to-dos in workspaces', defaultScope: 'project' },
  { id: 'create_tasks', name: 'Create Tasks', category: 'task_management', description: 'Add new tasks and deliverables', defaultScope: 'project' },
  { id: 'assign_tasks', name: 'Assign Tasks', category: 'task_management', description: 'Assign team members to tasks', defaultScope: 'project' },
  { id: 'edit_tasks', name: 'Edit Tasks', category: 'task_management', description: 'Modify task descriptions and checklists', defaultScope: 'assigned' },
  { id: 'delete_tasks', name: 'Delete Tasks', category: 'task_management', description: 'Remove tasks from workspaces', defaultScope: 'project' },
  { id: 'change_task_status', name: 'Change Task Status', category: 'task_management', description: 'Transition tasks across Kanban workflow', defaultScope: 'assigned' },
  { id: 'manage_task_priority', name: 'Manage Task Priority', category: 'task_management', description: 'Change task urgency or priority flags', defaultScope: 'project' },

  // D. Approval Management (MARS Core)
  { id: 'view_approval_center', name: 'View Approval Center', category: 'approval_management', description: 'Access project approval queue', defaultScope: 'department' },
  { id: 'submit_for_approval', name: 'Submit for Approval', category: 'approval_management', description: 'Submit task deliverables for review', defaultScope: 'assigned' },
  { id: 'approve_tasks', name: 'Approve Tasks', category: 'approval_management', description: 'Grant final task sign-off and mark completed', defaultScope: 'project', isSensitive: true },
  { id: 'request_revision', name: 'Request Revision', category: 'approval_management', description: 'Issue revision feedback and return tasks', defaultScope: 'project' },
  { id: 'view_approval_history', name: 'View Approval History', category: 'approval_management', description: 'Audit submission rounds and remarks', defaultScope: 'project' },

  // E. Collaboration
  { id: 'create_discussions', name: 'Create Discussions', category: 'collaboration', description: 'Post updates, topics, and announcements', defaultScope: 'project' },
  { id: 'comment', name: 'Comment & Discuss', category: 'collaboration', description: 'Add comments to tasks and topics', defaultScope: 'project' },
  { id: 'reply_comments', name: 'Reply to Comments', category: 'collaboration', description: 'Post threaded replies in discussions', defaultScope: 'project' },
  { id: 'edit_own_comments', name: 'Edit Own Comments', category: 'collaboration', description: 'Edit comments written by oneself', defaultScope: 'own' },
  { id: 'delete_own_comments', name: 'Delete Own Comments', category: 'collaboration', description: 'Remove comments written by oneself', defaultScope: 'own' },
  { id: 'moderate_discussions', name: 'Moderate Discussions', category: 'collaboration', description: 'Pin topics, remove inappropriate comments', defaultScope: 'department', isSensitive: true },
  { id: 'manage_announcements', name: 'Manage Announcements', category: 'collaboration', description: 'Post company-wide announcements', defaultScope: 'organization', isSensitive: true },

  // F. Files
  { id: 'upload_files', name: 'Upload Files', category: 'files', description: 'Upload documents, designs, and specs', defaultScope: 'project' },
  { id: 'download_files', name: 'Download Files', category: 'files', description: 'Download shared assets and documents', defaultScope: 'project' },
  { id: 'delete_own_files', name: 'Delete Own Files', category: 'files', description: 'Remove files uploaded by oneself', defaultScope: 'own' },
  { id: 'manage_folders', name: 'Manage Folders', category: 'files', description: 'Create and organize project file folders', defaultScope: 'project' },

  // G. Reports & Turnaround Time
  { id: 'view_personal_reports', name: 'View Personal Reports', category: 'reports', description: 'View own performance and TAT metrics', defaultScope: 'own' },
  { id: 'view_department_reports', name: 'View Department Reports', category: 'reports', description: 'View department-wide turnaround benchmarks', defaultScope: 'department' },
  { id: 'view_project_reports', name: 'View Project Reports', category: 'reports', description: 'View completion and SLA reports by project', defaultScope: 'project' },
  { id: 'view_organization_reports', name: 'View Organization Reports', category: 'reports', description: 'Access executive company-wide dashboards', defaultScope: 'organization', isSensitive: true },

  // H. System Administration
  { id: 'manage_roles_permissions', name: 'Manage Roles & Permissions', category: 'system_administration', description: 'Create custom roles and configure permission matrices', defaultScope: 'organization', isSensitive: true },
  { id: 'configure_system_settings', name: 'Configure System Settings', category: 'system_administration', description: 'Modify organization name, timezone, and parameters', defaultScope: 'organization', isSensitive: true },
  { id: 'view_audit_logs', name: 'View Audit Logs', category: 'system_administration', description: 'Inspect security audit trail of all actions', defaultScope: 'organization', isSensitive: true }
];

export const ALL_PERMISSION_IDS = SYSTEM_PERMISSIONS.map(p => p.id);

export const PERMISSION_CATEGORIES: { id: string; name: string; description: string }[] = [
  { id: 'user_management', name: 'User & Team Management', description: 'Accounts, invitations, and directory' },
  { id: 'project_management', name: 'Project Workspaces', description: 'Creation, editing, and archiving of workspaces' },
  { id: 'task_management', name: 'Tasks & Deliverables', description: 'Task assignment, checklists, and status transitions' },
  { id: 'approval_management', name: 'MARS Approvals & Turnaround', description: 'Submissions, revisions, and approvals' },
  { id: 'collaboration', name: 'Discussions & Comments', description: 'Message board, comments, and replies' },
  { id: 'files', name: 'Files & Assets', description: 'Document uploads, previews, and folders' },
  { id: 'reports', name: 'TAT Reports & Metrics', description: 'Performance metrics and turnaround analysis' },
  { id: 'system_administration', name: 'System Governance', description: 'Roles, organization settings, and audit logs' }
];

export function createDefaultRoles(organizationId: string): Role[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'role_super_admin',
      organizationId,
      name: 'Super Administrator',
      description: 'Unrestricted system and organizational control. Immutable primary authority.',
      level: 1,
      permissions: [...ALL_PERMISSION_IDS],
      scopes: ALL_PERMISSION_IDS.reduce((acc, id) => ({ ...acc, [id]: 'organization' }), {}),
      isSystemRole: true,
      status: 'active',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'role_admin',
      organizationId,
      name: 'Administrator',
      description: 'Organizational operational control, user provisioning, and department governance.',
      level: 2,
      permissions: ALL_PERMISSION_IDS.filter(id => id !== 'configure_system_settings'),
      scopes: ALL_PERMISSION_IDS.reduce((acc, id) => ({ ...acc, [id]: 'organization' }), {}),
      isSystemRole: true,
      status: 'active',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'role_manager',
      organizationId,
      name: 'Manager',
      description: 'Departmental authority, project creation, task assignment, and approval review.',
      level: 3,
      permissions: [
        'view_users', 'edit_users',
        'view_projects', 'create_projects', 'edit_projects', 'manage_project_members',
        'view_tasks', 'create_tasks', 'assign_tasks', 'edit_tasks', 'change_task_status', 'manage_task_priority',
        'view_approval_center', 'submit_for_approval', 'approve_tasks', 'request_revision', 'view_approval_history',
        'create_discussions', 'comment', 'reply_comments', 'edit_own_comments', 'delete_own_comments', 'moderate_discussions',
        'upload_files', 'download_files', 'delete_own_files', 'manage_folders',
        'view_personal_reports', 'view_department_reports', 'view_project_reports'
      ],
      scopes: {
        view_users: 'department',
        edit_users: 'department',
        view_projects: 'department',
        create_projects: 'department',
        edit_projects: 'department',
        manage_project_members: 'project',
        view_tasks: 'department',
        create_tasks: 'department',
        assign_tasks: 'department',
        edit_tasks: 'department',
        change_task_status: 'department',
        manage_task_priority: 'department',
        view_approval_center: 'department',
        submit_for_approval: 'assigned',
        approve_tasks: 'department',
        request_revision: 'department',
        view_approval_history: 'department',
        create_discussions: 'department',
        comment: 'department',
        reply_comments: 'department',
        edit_own_comments: 'own',
        delete_own_comments: 'own',
        moderate_discussions: 'department',
        upload_files: 'department',
        download_files: 'department',
        delete_own_files: 'own',
        manage_folders: 'department',
        view_personal_reports: 'own',
        view_department_reports: 'department',
        view_project_reports: 'department'
      },
      isSystemRole: true,
      status: 'active',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'role_team_leader',
      organizationId,
      name: 'Team Leader',
      description: 'Project coordination, task assignment, design triage, and turnaround monitoring.',
      level: 4,
      permissions: [
        'view_users',
        'view_projects', 'create_projects', 'edit_projects', 'manage_project_members',
        'view_tasks', 'create_tasks', 'assign_tasks', 'edit_tasks', 'change_task_status',
        'view_approval_center', 'submit_for_approval', 'request_revision', 'view_approval_history',
        'create_discussions', 'comment', 'reply_comments', 'edit_own_comments', 'delete_own_comments',
        'upload_files', 'download_files', 'delete_own_files', 'manage_folders',
        'view_personal_reports', 'view_project_reports'
      ],
      scopes: {
        view_users: 'department',
        view_projects: 'project',
        create_projects: 'project',
        edit_projects: 'project',
        manage_project_members: 'project',
        view_tasks: 'project',
        create_tasks: 'project',
        assign_tasks: 'project',
        edit_tasks: 'project',
        change_task_status: 'project',
        view_approval_center: 'project',
        submit_for_approval: 'assigned',
        request_revision: 'project',
        view_approval_history: 'project',
        create_discussions: 'project',
        comment: 'project',
        reply_comments: 'project',
        edit_own_comments: 'own',
        delete_own_comments: 'own',
        upload_files: 'project',
        download_files: 'project',
        delete_own_files: 'own',
        manage_folders: 'project',
        view_personal_reports: 'own',
        view_project_reports: 'project'
      },
      isSystemRole: true,
      status: 'active',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'role_member',
      organizationId,
      name: 'Member',
      description: 'Standard collaborator. Works on assigned tasks, submits work for approval, comments and uploads files.',
      level: 5,
      permissions: [
        'view_users',
        'view_projects',
        'view_tasks', 'create_tasks', 'edit_tasks', 'change_task_status',
        'submit_for_approval', 'view_approval_history',
        'create_discussions', 'comment', 'reply_comments', 'edit_own_comments', 'delete_own_comments',
        'upload_files', 'download_files', 'delete_own_files',
        'view_personal_reports'
      ],
      scopes: {
        view_users: 'organization',
        view_projects: 'project',
        view_tasks: 'project',
        create_tasks: 'project',
        edit_tasks: 'assigned',
        change_task_status: 'assigned',
        submit_for_approval: 'assigned',
        view_approval_history: 'project',
        create_discussions: 'project',
        comment: 'project',
        reply_comments: 'project',
        edit_own_comments: 'own',
        delete_own_comments: 'own',
        upload_files: 'project',
        download_files: 'project',
        delete_own_files: 'own',
        view_personal_reports: 'own'
      },
      isSystemRole: true,
      status: 'active',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'role_viewer',
      organizationId,
      name: 'Viewer',
      description: 'Read-only stakeholder. Can view authorized projects, tasks, files, and discussions.',
      level: 6,
      permissions: [
        'view_users',
        'view_projects',
        'view_tasks',
        'view_approval_history',
        'download_files',
        'view_personal_reports'
      ],
      scopes: {
        view_users: 'organization',
        view_projects: 'project',
        view_tasks: 'project',
        view_approval_history: 'project',
        download_files: 'project',
        view_personal_reports: 'own'
      },
      isSystemRole: true,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
  ];
}
