import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { Role, PermissionScope, User } from '../../types';
import { ALL_PERMISSION_IDS } from '../../constants/permissions';

export const roleService = {
  // Get all roles for organization
  async getRoles(orgId: string): Promise<Role[]> {
    const path = `organizations/${orgId}/roles`;
    try {
      const snap = await getDocs(collection(db, 'organizations', orgId, 'roles'));
      return snap.docs.map(d => d.data() as Role);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Create custom role
  async createRole(orgId: string, data: Partial<Role>): Promise<Role> {
    const roleId = `role_${Date.now()}`;
    const now = new Date().toISOString();

    const newRole: Role = sanitizeForFirestore({
      id: roleId,
      organizationId: orgId,
      name: data.name || 'Custom Role',
      description: data.description || '',
      level: data.level || 4,
      parentRoleId: data.parentRoleId || null,
      permissions: data.permissions || [],
      scopes: data.scopes || {},
      isSystemRole: false,
      status: 'active',
      createdAt: now,
      updatedAt: now
    });

    try {
      await setDoc(doc(db, 'organizations', orgId, 'roles', roleId), newRole);
      return newRole;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `organizations/${orgId}/roles/${roleId}`);
    }
  },

  // Update role and permission matrix
  async updateRole(orgId: string, roleId: string, updates: Partial<Role>): Promise<void> {
    // Prevent modifying core name or permissions of immutable Super Administrator
    if (roleId === 'role_super_admin' && updates.permissions && updates.permissions.length < ALL_PERMISSION_IDS.length) {
      throw new Error('Super Administrator permissions are immutable and cannot be diminished.');
    }

    try {
      await updateDoc(doc(db, 'organizations', orgId, 'roles', roleId), sanitizeForFirestore({
        ...updates,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}/roles/${roleId}`);
    }
  },

  // Delete role
  async deleteRole(orgId: string, roleId: string): Promise<void> {
    if (roleId === 'role_super_admin') {
      throw new Error('The Super Administrator system role cannot be deleted.');
    }

    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'roles', roleId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/roles/${roleId}`);
    }
  },

  // Compute effective permissions and highest scope for a user across all assigned roles
  getEffectivePermissions(
    userRoles: Role[]
  ): { permissions: Set<string>; scopes: Record<string, PermissionScope> } {
    const permissions = new Set<string>();
    const scopes: Record<string, PermissionScope> = {};

    const scopePriority: Record<PermissionScope, number> = {
      organization: 5,
      department: 4,
      project: 3,
      assigned: 2,
      own: 1
    };

    userRoles.forEach(role => {
      role.permissions.forEach(permId => {
        permissions.add(permId);
        const roleScope = role.scopes?.[permId] || 'organization';
        const currentScope = scopes[permId];

        if (!currentScope || scopePriority[roleScope] > scopePriority[currentScope]) {
          scopes[permId] = roleScope;
        }
      });
    });

    return { permissions, scopes };
  },

  // Check if a user possesses a required permission
  hasPermission(
    user: User,
    allRoles: Role[],
    permissionId: string,
    targetScope?: PermissionScope
  ): boolean {
    const userRoleIds = Array.isArray(user.roleIds) ? user.roleIds : [];
    if (userRoleIds.includes('role_super_admin') || user.email === 'mmarcialpa@gmail.com') {
      return true; // Super Admin has universal access
    }

    const assignedRoles = allRoles.filter(r => userRoleIds.includes(r.id));
    const { permissions, scopes } = this.getEffectivePermissions(assignedRoles);

    if (!permissions.has(permissionId)) {
      return false;
    }

    if (!targetScope) {
      return true;
    }

    const userScope = scopes[permissionId];
    const scopeRank: Record<PermissionScope, number> = {
      organization: 5,
      department: 4,
      project: 3,
      assigned: 2,
      own: 1
    };

    return (scopeRank[userScope] || 0) >= (scopeRank[targetScope] || 0);
  }
};
