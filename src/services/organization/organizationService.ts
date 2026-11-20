import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  getDocsFromServer,
  query,
  where,
  writeBatch,
  serverTimestamp,
  DocumentReference,
  CollectionReference
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import {
  SystemConfig,
  Organization,
  Department,
  Position,
  Role,
  User,
  SetupSectionKey,
  SectionSaveState
} from '../../types';
import { createDefaultRoles } from '../../constants/permissions';
import { INITIAL_SYSTEM_CONFIG } from '../../data/initialData';

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml'
]);

async function fetchDocVerified(docRef: DocumentReference) {
  try {
    return await getDocFromServer(docRef);
  } catch {
    return await getDoc(docRef);
  }
}

async function fetchCollectionVerified(colRef: CollectionReference) {
  try {
    return await getDocsFromServer(colRef);
  } catch {
    return await getDocs(colRef);
  }
}

function mergeCompletedSection(
  existing: SetupSectionKey[] | undefined,
  section: SetupSectionKey,
  isComplete: boolean
): SetupSectionKey[] {
  const set = new Set<SetupSectionKey>(Array.isArray(existing) ? existing : []);
  if (isComplete) {
    set.add(section);
  } else {
    set.delete(section);
  }
  return Array.from(set);
}

export interface AuthoritativeSetupState {
  systemConfig: SystemConfig;
  organization: Organization | null;
  superAdmin: User | null;
  departments: Department[];
  positions: Position[];
  roles: Role[];
  verifiedAt: string;
}

export const organizationService = {
  // Check global system initialization state
  async getSystemConfig(): Promise<SystemConfig> {
    try {
      const snap = await fetchDocVerified(doc(db, 'system', 'config'));
      if (!snap.exists()) {
        return { ...INITIAL_SYSTEM_CONFIG };
      }
      const data = snap.data() as SystemConfig;
      return {
        ...INITIAL_SYSTEM_CONFIG,
        ...data,
        completedSections: Array.isArray(data.completedSections) ? data.completedSections : [],
        sectionStatuses: {
          ...INITIAL_SYSTEM_CONFIG.sectionStatuses,
          ...(data.sectionStatuses || {})
        }
      };
    } catch (error) {
      console.warn('System config fetch error (treating as uninitialized):', error);
      return { ...INITIAL_SYSTEM_CONFIG };
    }
  },

  // Persist partial setup progress to /system/config and verify readback
  async updateSetupProgress(
    orgId: string | null,
    updates: Partial<SystemConfig>
  ): Promise<SystemConfig> {
    const configRef = doc(db, 'system', 'config');
    const now = new Date().toISOString();

    try {
      const current = await this.getSystemConfig();
      const resolvedOrgId = updates.organizationId !== undefined ? updates.organizationId : (orgId || current.organizationId || null);

      const mergedStatuses: Partial<Record<SetupSectionKey, SectionSaveState>> = {
        ...(current.sectionStatuses || {}),
        ...(updates.sectionStatuses || {})
      };

      const payload = sanitizeForFirestore({
        ...current,
        ...updates,
        organizationId: resolvedOrgId,
        sectionStatuses: mergedStatuses,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
        schemaVersion: 2
      });

      await setDoc(configRef, payload, { merge: true });
      const verified = await fetchDocVerified(configRef);
      if (!verified.exists()) {
        throw new Error('Firestore verification failed: system/config did not persist.');
      }
      return verified.data() as SystemConfig;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'system/config');
    }
  },

  // Upload Organization Logo to Firebase Storage
  async uploadOrganizationLogo(
    orgId: string,
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<string> {
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      throw new Error('Organization logo must be 5 MB or smaller.');
    }
    if (file.type && !ALLOWED_LOGO_TYPES.has(file.type)) {
      throw new Error('Please upload a PNG, JPG, WEBP, or SVG image file.');
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetOrgId = orgId || 'draft_org';
    const storageRef = ref(storage, `organizations/${targetOrgId}/branding/${Date.now()}_${safeName}`);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'image/png'
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          }
        },
        (err) => {
          reject(new Error(`Logo upload failed (${err.code || 'storage'}): ${err.message}`));
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err: any) {
            reject(new Error(`Failed to resolve logo URL: ${err?.message || String(err)}`));
          }
        }
      );
    });
  },

  // Section 1: Save Organization Information independently and verify persistence in Firestore
  async saveOrganizationSection(params: {
    orgId?: string | null;
    actorId: string;
    data: {
      name: string;
      logoUrl?: string;
      companyEmail?: string;
      contactNumber?: string;
      officeAddress?: string;
      description?: string;
      timezone: string;
    };
    existingConfig?: SystemConfig;
  }): Promise<{ organization: Organization; systemConfig: SystemConfig; roles: Role[] }> {
    const trimmedName = params.data.name.trim();
    if (!trimmedName) {
      throw new Error('Organization Name is required.');
    }
    if (!params.data.timezone) {
      throw new Error('Primary Timezone is required.');
    }

    const now = new Date().toISOString();
    const currentConfig = params.existingConfig || (await this.getSystemConfig());
    const orgId = params.orgId || currentConfig.organizationId || `org_${Date.now()}`;

    try {
      // Prevent duplicate organization names (case-insensitive)
      const orgsSnap = await fetchCollectionVerified(collection(db, 'organizations'));
      const duplicateOrg = orgsSnap.docs.find((d) => {
        if (d.id === orgId) return false;
        const dName = (d.data() as Organization).name || '';
        return dName.trim().toLowerCase() === trimmedName.toLowerCase();
      });
      if (duplicateOrg) {
        throw new Error(`An organization named "${trimmedName}" already exists.`);
      }

      const orgRef = doc(db, 'organizations', orgId);
      const existingOrgSnap = await fetchDocVerified(orgRef);
      const existingOrg = existingOrgSnap.exists() ? (existingOrgSnap.data() as Organization) : null;

      const orgPayload: Organization & Record<string, unknown> = sanitizeForFirestore({
        id: orgId,
        name: trimmedName,
        logoUrl: params.data.logoUrl?.trim() || '',
        companyEmail: params.data.companyEmail?.trim() || '',
        contactNumber: params.data.contactNumber?.trim() || '',
        officeAddress: params.data.officeAddress?.trim() || '',
        description: params.data.description?.trim() || '',
        timezone: params.data.timezone,
        defaultLanguage: existingOrg?.defaultLanguage || 'en',
        allowPublicRegistration: existingOrg?.allowPublicRegistration ?? false,
        status: existingOrg?.status === 'active' ? 'active' : 'setup',
        setupStatus: currentConfig.initialized ? 'active' : 'in_progress',
        createdBy: existingOrg?.createdBy || params.actorId,
        createdAt: existingOrg?.createdAt || now,
        updatedAt: now,
        launchedAt: existingOrg?.launchedAt ?? null,
        updatedAtServer: serverTimestamp(),
        ...(existingOrg ? {} : { createdAtServer: serverTimestamp() })
      });

      const batch = writeBatch(db);
      batch.set(orgRef, orgPayload, { merge: true });

      // Ensure default system roles exist for this organization
      const existingRolesSnap = await fetchCollectionVerified(collection(db, 'organizations', orgId, 'roles'));
      let rolesList = existingRolesSnap.docs.map((d) => d.data() as Role);
      if (rolesList.length === 0 || !rolesList.some((r) => r.id === 'role_super_admin')) {
        const defaultRoles = createDefaultRoles(orgId);
        for (const role of defaultRoles) {
          if (!rolesList.some((r) => r.id === role.id)) {
            batch.set(doc(db, 'organizations', orgId, 'roles', role.id), sanitizeForFirestore(role));
            rolesList.push(role);
          }
        }
      }

      const completedSections = mergeCompletedSection(currentConfig.completedSections, 'organization', true);
      const nextStatuses: Partial<Record<SetupSectionKey, SectionSaveState>> = {
        ...(currentConfig.sectionStatuses || {}),
        organization: 'completed'
      };

      const configPayload = sanitizeForFirestore({
        ...currentConfig,
        initialized: Boolean(currentConfig.initialized),
        organizationId: orgId,
        organizationName: trimmedName,
        registrationPolicy: existingOrg?.registrationPolicy || currentConfig.registrationPolicy || 'invitation_only',
        requireEmailVerification:
          existingOrg?.requireEmailVerification ?? currentConfig.requireEmailVerification ?? false,
        requireAdminApproval:
          existingOrg?.requireAdminApproval ?? currentConfig.requireAdminApproval ?? true,
        setupStatus: currentConfig.initialized ? 'active' : 'in_progress',
        currentSection: 'organization',
        completedSections,
        sectionStatuses: nextStatuses,
        createdBy: currentConfig.createdBy || params.actorId,
        createdAt: currentConfig.createdAt || now,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
        schemaVersion: 2
      });
      batch.set(doc(db, 'system', 'config'), configPayload, { merge: true });

      await batch.commit();

      // Verify persistence by re-reading directly from Firestore
      const [verifiedOrgSnap, verifiedConfigSnap] = await Promise.all([
        fetchDocVerified(orgRef),
        fetchDocVerified(doc(db, 'system', 'config'))
      ]);

      if (!verifiedOrgSnap.exists() || !verifiedConfigSnap.exists()) {
        throw new Error('Verification read failed: Organization record was not found after write.');
      }

      const savedOrg = verifiedOrgSnap.data() as Organization;
      if (savedOrg.name !== trimmedName) {
        throw new Error('Verification mismatch: Saved organization name does not match.');
      }

      return {
        organization: savedOrg,
        systemConfig: verifiedConfigSnap.data() as SystemConfig,
        roles: rolesList
      };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('required') || error.message.includes('Verification'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `organizations/${orgId}`);
    }
  },

  // Section 2: Save & Verify Super Administrator bound to Firebase Auth UID (never stores password)
  async saveSuperAdminSection(params: {
    orgId?: string | null;
    fbUser: {
      uid: string;
      email?: string | null;
      photoURL?: string | null;
      emailVerified?: boolean;
    };
    profile: {
      firstName: string;
      lastName: string;
      email: string;
    };
    existingConfig?: SystemConfig;
  }): Promise<{
    superAdminUser: User;
    organization: Organization;
    systemConfig: SystemConfig;
    roles: Role[];
  }> {
    if (!auth.currentUser || auth.currentUser.uid !== params.fbUser.uid) {
      throw new Error('An active Firebase authenticated session matching this Super Administrator is required.');
    }

    const firstName = params.profile.firstName.trim();
    const lastName = params.profile.lastName.trim();
    const email = (params.profile.email || params.fbUser.email || '').trim().toLowerCase();

    if (!firstName || !email) {
      throw new Error('Super Administrator first name and email address are required.');
    }

    const now = new Date().toISOString();
    const currentConfig = params.existingConfig || (await this.getSystemConfig());
    const orgId = params.orgId || currentConfig.organizationId || `org_${Date.now()}`;

    try {
      const orgRef = doc(db, 'organizations', orgId);
      const userRef = doc(db, 'users', params.fbUser.uid);
      const adminRef = doc(db, 'admins', params.fbUser.uid);

      const [existingOrgSnap, existingUserSnap, existingRolesSnap] = await Promise.all([
        fetchDocVerified(orgRef),
        fetchDocVerified(userRef),
        fetchCollectionVerified(collection(db, 'organizations', orgId, 'roles'))
      ]);

      // Prevent duplicate user records with the same email under a different UID in this org
      if (existingOrgSnap.exists()) {
        const existingEmailUsers = await getDocs(
          query(collection(db, 'users'), where('email', '==', email))
        ).catch(() => null);
        if (existingEmailUsers) {
          const conflictingDoc = existingEmailUsers.docs.find((d) => d.id !== params.fbUser.uid && (d.data() as User).organizationId === orgId);
          if (conflictingDoc) {
            throw new Error(`A user profile for ${email} already exists under a different account (${conflictingDoc.id}).`);
          }
        }
      }

      const batch = writeBatch(db);

      let resolvedOrg: Organization;
      if (!existingOrgSnap.exists()) {
        resolvedOrg = sanitizeForFirestore({
          id: orgId,
          name: 'MARS Workspace (Draft)',
          description: '',
          logoUrl: '',
          timezone: 'America/New_York',
          defaultLanguage: 'en',
          allowPublicRegistration: false,
          status: 'setup',
          setupStatus: 'in_progress',
          createdBy: params.fbUser.uid,
          createdAt: now,
          updatedAt: now,
          launchedAt: null
        });
        batch.set(orgRef, {
          ...resolvedOrg,
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp()
        });
      } else {
        resolvedOrg = existingOrgSnap.data() as Organization;
      }

      let rolesList = existingRolesSnap.docs.map((d) => d.data() as Role);
      if (rolesList.length === 0 || !rolesList.some((r) => r.id === 'role_super_admin')) {
        const defaultRoles = createDefaultRoles(orgId);
        for (const role of defaultRoles) {
          if (!rolesList.some((r) => r.id === role.id)) {
            batch.set(doc(db, 'organizations', orgId, 'roles', role.id), sanitizeForFirestore(role));
            rolesList.push(role);
          }
        }
      }

      const existingUserData = existingUserSnap.exists() ? (existingUserSnap.data() as User) : null;
      const existingRoleIds = Array.isArray(existingUserData?.roleIds) ? existingUserData!.roleIds : [];
      const mergedRoleIds = Array.from(new Set(['role_super_admin', ...existingRoleIds]));
      const fullName = `${firstName} ${lastName}`.trim();

      const adminUserPayload: User & Record<string, unknown> = sanitizeForFirestore({
        ...(existingUserData || {}),
        id: params.fbUser.uid,
        organizationId: orgId,
        firstName,
        lastName,
        name: fullName,
        email,
        avatar:
          params.fbUser.photoURL ||
          existingUserData?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0f172a&color=fff`,
        departmentId: existingUserData?.departmentId ?? null,
        positionId: existingUserData?.positionId ?? null,
        managerId: existingUserData?.managerId ?? null,
        roleIds: mergedRoleIds,
        primaryRoleId: 'role_super_admin',
        role: 'super_admin',
        accountStatus: 'active',
        emailVerified: Boolean(params.fbUser.emailVerified || existingUserData?.emailVerified),
        dateJoined: existingUserData?.dateJoined || now.split('T')[0],
        createdAt: existingUserData?.createdAt || now,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
        ...(existingUserData ? {} : { createdAtServer: serverTimestamp() })
      });

      batch.set(userRef, adminUserPayload, { merge: true });
      batch.set(
        adminRef,
        sanitizeForFirestore({
          id: params.fbUser.uid,
          email,
          organizationId: orgId,
          role: 'role_super_admin',
          updatedAt: now,
          updatedAtServer: serverTimestamp()
        }),
        { merge: true }
      );

      const completedSections = mergeCompletedSection(currentConfig.completedSections, 'super_admin', true);
      const nextStatuses: Partial<Record<SetupSectionKey, SectionSaveState>> = {
        ...(currentConfig.sectionStatuses || {}),
        super_admin: 'completed'
      };

      const configPayload = sanitizeForFirestore({
        ...currentConfig,
        initialized: Boolean(currentConfig.initialized),
        organizationId: orgId,
        superAdminId: params.fbUser.uid,
        setupStatus: currentConfig.initialized ? 'active' : 'in_progress',
        currentSection: 'super_admin',
        completedSections,
        sectionStatuses: nextStatuses,
        createdBy: currentConfig.createdBy || params.fbUser.uid,
        createdAt: currentConfig.createdAt || now,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
        schemaVersion: 2
      });
      batch.set(doc(db, 'system', 'config'), configPayload, { merge: true });

      await batch.commit();

      const [verifiedUserSnap, verifiedOrgSnap, verifiedConfigSnap] = await Promise.all([
        fetchDocVerified(userRef),
        fetchDocVerified(orgRef),
        fetchDocVerified(doc(db, 'system', 'config'))
      ]);

      if (!verifiedUserSnap.exists() || !verifiedConfigSnap.exists()) {
        throw new Error('Verification read failed: Super Administrator profile was not persisted.');
      }

      return {
        superAdminUser: verifiedUserSnap.data() as User,
        organization: (verifiedOrgSnap.exists() ? verifiedOrgSnap.data() : resolvedOrg) as Organization,
        systemConfig: verifiedConfigSnap.data() as SystemConfig,
        roles: rolesList
      };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('required') || error.message.includes('Verification') || error.message.includes('authenticated'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `users/${params.fbUser.uid}`);
    }
  },

  // First-time Super Administrator bootstrap & organization initialization (atomic writeBatch)
  async initializeOrganization(
    orgData: { name: string; description?: string; logoUrl?: string; timezone: string },
    superAdminUser: User,
    initialDepartments: Partial<Department>[] = [],
    initialPositions: Partial<Position>[] = []
  ): Promise<{ organization: Organization; roles: Role[] }> {
    const orgId = `org_${Date.now()}`;
    const now = new Date().toISOString();

    const organization: Organization = sanitizeForFirestore({
      id: orgId,
      name: orgData.name,
      description: orgData.description || 'Primary Enterprise Organization',
      logoUrl: orgData.logoUrl || '',
      timezone: orgData.timezone || 'UTC',
      defaultLanguage: 'en',
      allowPublicRegistration: false,
      status: 'active',
      setupStatus: 'active',
      createdAt: now,
      updatedAt: now,
      launchedAt: now
    });

    try {
      const batch = writeBatch(db);

      // 1. Create Organization Document
      batch.set(doc(db, 'organizations', orgId), {
        ...organization,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
        launchedAtServer: serverTimestamp()
      });

      // 2. Initialize Default Roles
      const defaultRoles = createDefaultRoles(orgId);
      for (const role of defaultRoles) {
        batch.set(doc(db, 'organizations', orgId, 'roles', role.id), sanitizeForFirestore(role));
      }

      // 3. Create Super Admin User Record
      const adminProfile: User = sanitizeForFirestore({
        ...superAdminUser,
        organizationId: orgId,
        roleIds: ['role_super_admin'],
        primaryRoleId: 'role_super_admin',
        accountStatus: 'active',
        dateJoined: now.split('T')[0],
        createdAt: now,
        updatedAt: now
      });
      batch.set(doc(db, 'users', superAdminUser.id), {
        ...adminProfile,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp()
      });

      // 4. Create Initial Departments (preserving provided IDs so positions link properly)
      const deptIdMap = new Map<string, string>();
      for (const dept of initialDepartments) {
        if (dept.name) {
          const deptId = dept.id || `dept_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          if (dept.id) deptIdMap.set(dept.id, deptId);
          const headId = dept.departmentHeadId || dept.headUserId || null;
          const fullDept: Department = sanitizeForFirestore({
            id: deptId,
            organizationId: orgId,
            name: dept.name,
            description: dept.description || '',
            parentDepartmentId: dept.parentDepartmentId || null,
            departmentHeadId: headId,
            headUserId: headId,
            status: 'active',
            memberCount: 0,
            createdAt: now,
            updatedAt: now
          });
          batch.set(doc(db, 'organizations', orgId, 'departments', deptId), fullDept);
        }
      }

      // 5. Create Initial Positions
      for (const pos of initialPositions) {
        if (pos.title && pos.departmentId) {
          const posId = pos.id || `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const resolvedDeptId = deptIdMap.get(pos.departmentId) || pos.departmentId;
          const fullPos: Position = sanitizeForFirestore({
            id: posId,
            organizationId: orgId,
            title: pos.title,
            departmentId: resolvedDeptId,
            parentPositionId: pos.parentPositionId || null,
            level: pos.level || pos.organizationalLevel || 3,
            organizationalLevel: pos.organizationalLevel || pos.level || 3,
            description: pos.description || '',
            status: 'active',
            assignedEmployeeCount: 0,
            createdAt: now,
            updatedAt: now
          });
          batch.set(doc(db, 'organizations', orgId, 'positions', posId), fullPos);
        }
      }

      // 6. Mark System as Initialized
      const config: SystemConfig = {
        initialized: true,
        organizationId: orgId,
        superAdminId: superAdminUser.id,
        setupCompletedAt: now,
        setupStatus: 'active',
        completedSections: ['organization', 'super_admin', 'departments', 'positions', 'review'],
        currentSection: 'review',
        sectionStatuses: {
          organization: 'completed',
          super_admin: 'completed',
          departments: 'completed',
          positions: 'completed',
          review: 'completed'
        },
        launchedAt: now,
        updatedAt: now,
        schemaVersion: 2
      };
      batch.set(doc(db, 'system', 'config'), {
        ...config,
        updatedAtServer: serverTimestamp(),
        launchedAtServer: serverTimestamp()
      });

      await batch.commit();
      return { organization, roles: defaultRoles };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `organizations/${orgId}`);
    }
  },

  // Get Organization Details
  async getOrganization(orgId: string): Promise<Organization | null> {
    try {
      const snap = await fetchDocVerified(doc(db, 'organizations', orgId));
      if (!snap.exists()) return null;
      return snap.data() as Organization;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `organizations/${orgId}`);
    }
  },

  // Update Organization Details
  async updateOrganization(orgId: string, updates: Partial<Organization>): Promise<void> {
    try {
      await updateDoc(doc(db, 'organizations', orgId), sanitizeForFirestore({
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}`);
    }
  },

  // Get Departments
  async getDepartments(orgId: string): Promise<Department[]> {
    const path = `organizations/${orgId}/departments`;
    try {
      const snap = await fetchCollectionVerified(collection(db, 'organizations', orgId, 'departments'));
      return snap.docs.map(d => {
        const data = d.data() as Department;
        const headId = data.headUserId || data.departmentHeadId || null;
        return { ...data, headUserId: headId, departmentHeadId: headId };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Create Department (with duplicate name prevention & Firestore verification)
  async createDepartment(orgId: string, data: Partial<Department>): Promise<Department> {
    const trimmedName = (data.name || '').trim();
    if (!trimmedName) {
      throw new Error('Department name is required.');
    }

    const existingDepts = await this.getDepartments(orgId);
    const duplicate = existingDepts.find(
      (d) => d.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A department named "${trimmedName}" already exists.`);
    }

    const deptId = `dept_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const headId = data.headUserId ?? data.departmentHeadId ?? null;
    const newDept: Department = sanitizeForFirestore({
      id: deptId,
      organizationId: orgId,
      name: trimmedName,
      description: data.description?.trim() || '',
      parentDepartmentId: data.parentDepartmentId || null,
      departmentHeadId: headId,
      headUserId: headId,
      status: data.status || 'active',
      memberCount: 0,
      createdAt: now,
      updatedAt: now
    });

    const deptRef = doc(db, 'organizations', orgId, 'departments', deptId);
    try {
      await setDoc(deptRef, {
        ...newDept,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp()
      });
      const verified = await fetchDocVerified(deptRef);
      if (!verified.exists()) {
        throw new Error('Verification failed: Department was not saved in Firestore.');
      }
      return verified.data() as Department;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('Verification') || error.message.includes('required'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `organizations/${orgId}/departments/${deptId}`);
    }
  },

  // Update Department (with duplicate name prevention & circular check)
  async updateDepartment(orgId: string, deptId: string, updates: Partial<Department>): Promise<void> {
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) throw new Error('Department name cannot be empty.');
      const existingDepts = await this.getDepartments(orgId);
      const duplicate = existingDepts.find(
        (d) => d.id !== deptId && d.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`A department named "${trimmedName}" already exists.`);
      }
      updates.name = trimmedName;
    }

    if (updates.parentDepartmentId === deptId) {
      throw new Error('A department cannot be its own parent.');
    }

    try {
      const normalized = { ...updates };
      if ('headUserId' in updates || 'departmentHeadId' in updates) {
        const headId = updates.headUserId ?? updates.departmentHeadId ?? null;
        normalized.headUserId = headId;
        normalized.departmentHeadId = headId;
      }
      const deptRef = doc(db, 'organizations', orgId, 'departments', deptId);
      await updateDoc(deptRef, sanitizeForFirestore({
        ...normalized,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp()
      }));
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('cannot'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}/departments/${deptId}`);
    }
  },

  // Safely delete Department (checks references across positions, sub-departments, and users)
  async deleteDepartment(orgId: string, deptId: string): Promise<void> {
    const [depts, positions, usersSnap] = await Promise.all([
      this.getDepartments(orgId),
      this.getPositions(orgId),
      getDocs(query(collection(db, 'users'), where('organizationId', '==', orgId))).catch(() => null)
    ]);

    const childDepts = depts.filter((d) => d.parentDepartmentId === deptId);
    if (childDepts.length > 0) {
      throw new Error(`Cannot delete: ${childDepts.length} sub-department(s) report under this department. Reassign or deactivate instead.`);
    }

    const linkedPositions = positions.filter((p) => p.departmentId === deptId);
    if (linkedPositions.length > 0) {
      throw new Error(`Cannot delete: ${linkedPositions.length} position(s) are assigned to this department. Reassign or deactivate instead.`);
    }

    if (usersSnap) {
      const linkedUsers = usersSnap.docs.filter((d) => (d.data() as User).departmentId === deptId);
      if (linkedUsers.length > 0) {
        throw new Error(`Cannot delete: ${linkedUsers.length} user(s) belong to this department. Reassign or deactivate instead.`);
      }
    }

    const deptRef = doc(db, 'organizations', orgId, 'departments', deptId);
    try {
      await deleteDoc(deptRef);
      const verify = await fetchDocVerified(deptRef);
      if (verify.exists()) {
        throw new Error('Verification failed: Department still exists after deletion.');
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Cannot delete') || error.message.includes('Verification'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/departments/${deptId}`);
    }
  },

  // Get Positions
  async getPositions(orgId: string): Promise<Position[]> {
    const path = `organizations/${orgId}/positions`;
    try {
      const snap = await fetchCollectionVerified(collection(db, 'organizations', orgId, 'positions'));
      return snap.docs.map(d => d.data() as Position);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Create Position (with duplicate check, department check, & Firestore verification)
  async createPosition(orgId: string, data: Partial<Position>): Promise<Position> {
    const trimmedTitle = (data.title || '').trim();
    if (!trimmedTitle) {
      throw new Error('Position title is required.');
    }

    const [existingPositions, existingDepts] = await Promise.all([
      this.getPositions(orgId),
      this.getDepartments(orgId)
    ]);

    const duplicate = existingPositions.find(
      (p) => p.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A position titled "${trimmedTitle}" already exists.`);
    }

    if (data.departmentId && !existingDepts.some((d) => d.id === data.departmentId)) {
      throw new Error('Selected department no longer exists in Firestore. Please refresh departments.');
    }

    const posId = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newPos: Position = sanitizeForFirestore({
      id: posId,
      organizationId: orgId,
      title: trimmedTitle,
      departmentId: data.departmentId || null,
      parentPositionId: data.parentPositionId || null,
      level: data.level || data.organizationalLevel || 3,
      organizationalLevel: data.organizationalLevel || data.level || 3,
      description: data.description?.trim() || '',
      status: data.status || 'active',
      assignedEmployeeCount: 0,
      createdAt: now,
      updatedAt: now
    });

    const posRef = doc(db, 'organizations', orgId, 'positions', posId);
    try {
      await setDoc(posRef, {
        ...newPos,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp()
      });
      const verified = await fetchDocVerified(posRef);
      if (!verified.exists()) {
        throw new Error('Verification failed: Position was not saved in Firestore.');
      }
      return verified.data() as Position;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('Verification') || error.message.includes('required') || error.message.includes('department'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `organizations/${orgId}/positions/${posId}`);
    }
  },

  // Update Position (with duplicate check, cycle check, & department validation)
  async updatePosition(orgId: string, posId: string, updates: Partial<Position>): Promise<void> {
    const existingPositions = await this.getPositions(orgId);

    if (updates.title !== undefined) {
      const trimmedTitle = updates.title.trim();
      if (!trimmedTitle) throw new Error('Position title cannot be empty.');
      const duplicate = existingPositions.find(
        (p) => p.id !== posId && p.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`A position titled "${trimmedTitle}" already exists.`);
      }
      updates.title = trimmedTitle;
    }

    if (updates.parentPositionId) {
      const isCycle = this.detectReportingCycle(existingPositions, posId, updates.parentPositionId);
      if (isCycle) {
        throw new Error('Circular reporting detected! A position cannot report to itself or to any of its subordinate positions.');
      }
    }

    if (updates.departmentId) {
      const existingDepts = await this.getDepartments(orgId);
      if (!existingDepts.some((d) => d.id === updates.departmentId)) {
        throw new Error('Selected department does not exist in Firestore.');
      }
    }

    try {
      await updateDoc(doc(db, 'organizations', orgId, 'positions', posId), sanitizeForFirestore({
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp()
      }));
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('Circular') || error.message.includes('department'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}/positions/${posId}`);
    }
  },

  // Safely delete Position (checks child reporting lines & assigned users)
  async deletePosition(orgId: string, posId: string): Promise<void> {
    const [positions, usersSnap] = await Promise.all([
      this.getPositions(orgId),
      getDocs(query(collection(db, 'users'), where('organizationId', '==', orgId))).catch(() => null)
    ]);

    const childPositions = positions.filter((p) => p.parentPositionId === posId);
    if (childPositions.length > 0) {
      throw new Error(`Cannot delete: ${childPositions.length} subordinate position(s) report to this position. Update reporting lines or deactivate instead.`);
    }

    if (usersSnap) {
      const linkedUsers = usersSnap.docs.filter((d) => (d.data() as User).positionId === posId);
      if (linkedUsers.length > 0) {
        throw new Error(`Cannot delete: ${linkedUsers.length} user(s) currently hold this position. Reassign or deactivate instead.`);
      }
    }

    const posRef = doc(db, 'organizations', orgId, 'positions', posId);
    try {
      await deleteDoc(posRef);
      const verify = await fetchDocVerified(posRef);
      if (verify.exists()) {
        throw new Error('Verification failed: Position still exists after deletion.');
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Cannot delete') || error.message.includes('Verification'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/positions/${posId}`);
    }
  },

  // Re-read authoritative state from Firestore for Review & Launch verification
  async getAuthoritativeSetupState(preferredOrgId?: string | null): Promise<AuthoritativeSetupState> {
    const config = await this.getSystemConfig();
    const orgId = preferredOrgId || config.organizationId;

    if (!orgId || !auth.currentUser) {
      return {
        systemConfig: config,
        organization: null,
        superAdmin: null,
        departments: [],
        positions: [],
        roles: [],
        verifiedAt: new Date().toISOString()
      };
    }

    const [org, depts, posList, rolesSnap, adminSnap] = await Promise.all([
      this.getOrganization(orgId).catch(() => null),
      this.getDepartments(orgId).catch(() => [] as Department[]),
      this.getPositions(orgId).catch(() => [] as Position[]),
      fetchCollectionVerified(collection(db, 'organizations', orgId, 'roles')).catch(() => null),
      config.superAdminId
        ? fetchDocVerified(doc(db, 'users', config.superAdminId)).catch(() => null)
        : Promise.resolve(null)
    ]);

    return {
      systemConfig: config,
      organization: org,
      superAdmin: adminSnap && adminSnap.exists() ? (adminSnap.data() as User) : null,
      departments: depts,
      positions: posList,
      roles: rolesSnap ? rolesSnap.docs.map((d) => d.data() as Role) : [],
      verifiedAt: new Date().toISOString()
    };
  },

  // Section 5: Validate authoritative Firestore records & atomically launch the organization
  async launchOrganization(
    orgId: string,
    actorUser: User
  ): Promise<{ organization: Organization; systemConfig: SystemConfig; superAdmin: User }> {
    const state = await this.getAuthoritativeSetupState(orgId);

    if (state.systemConfig.initialized && state.organization?.status === 'active') {
      return {
        organization: state.organization,
        systemConfig: state.systemConfig,
        superAdmin: state.superAdmin || actorUser
      };
    }

    // 1. Validate Organization
    if (!state.organization || !state.organization.name?.trim() || state.organization.name === 'MARS Workspace (Draft)') {
      throw new Error('Organization Information is incomplete. Please save a valid Organization Name and Timezone first.');
    }
    if (!state.organization.timezone?.trim()) {
      throw new Error('Primary Timezone is missing from the saved Organization record.');
    }

    // 2. Validate Super Administrator in Firestore
    const targetAdminId = state.systemConfig.superAdminId || actorUser.id;
    const adminSnap = await fetchDocVerified(doc(db, 'users', targetAdminId));
    if (!adminSnap.exists()) {
      throw new Error('Super Administrator profile was not found in Firestore. Please complete Section 2.');
    }
    const superAdmin = adminSnap.data() as User;
    if (!superAdmin.roleIds?.includes('role_super_admin')) {
      throw new Error('Super Administrator record is missing the role_super_admin assignment.');
    }
    if (superAdmin.accountStatus !== 'active') {
      throw new Error('Super Administrator account must have an active status before launch.');
    }

    // 3. Validate Active Departments
    const activeDepartments = state.departments.filter((d) => d.status === 'active');
    if (activeDepartments.length === 0) {
      throw new Error('At least one active Department must be saved in Firestore before launching.');
    }

    // 4. Validate Active Positions & Department Foreign Keys
    const activePositions = state.positions.filter((p) => p.status === 'active');
    if (activePositions.length === 0) {
      throw new Error('At least one active Position must be saved in Firestore before launching.');
    }
    const allDeptIds = new Set(state.departments.map((d) => d.id));
    const orphanedPosition = activePositions.find((p) => p.departmentId && !allDeptIds.has(p.departmentId));
    if (orphanedPosition) {
      throw new Error(`Position "${orphanedPosition.title}" references a missing department. Please reassign its department.`);
    }

    const now = new Date().toISOString();
    const batch = writeBatch(db);

    // Ensure default roles exist
    if (state.roles.length === 0 || !state.roles.some((r) => r.id === 'role_super_admin')) {
      const defaultRoles = createDefaultRoles(state.organization.id);
      for (const role of defaultRoles) {
        if (!state.roles.some((r) => r.id === role.id)) {
          batch.set(doc(db, 'organizations', state.organization.id, 'roles', role.id), sanitizeForFirestore(role));
        }
      }
    }

    const orgRef = doc(db, 'organizations', state.organization.id);
    batch.update(
      orgRef,
      sanitizeForFirestore({
        status: 'active',
        setupStatus: 'active',
        launchedAt: now,
        launchedAtServer: serverTimestamp(),
        updatedAt: now,
        updatedAtServer: serverTimestamp()
      })
    );

    const configRef = doc(db, 'system', 'config');
    batch.set(
      configRef,
      sanitizeForFirestore({
        initialized: true,
        organizationId: state.organization.id,
        organizationName: state.organization.name,
        superAdminId: superAdmin.id,
        registrationPolicy:
          state.organization.registrationPolicy ||
          state.systemConfig.registrationPolicy ||
          'invitation_only',
        requireEmailVerification:
          state.organization.requireEmailVerification ??
          state.systemConfig.requireEmailVerification ??
          false,
        requireAdminApproval:
          state.organization.requireAdminApproval ??
          state.systemConfig.requireAdminApproval ??
          true,
        setupStatus: 'active',
        setupCompletedAt: now,
        launchedAt: now,
        launchedAtServer: serverTimestamp(),
        completedSections: ['organization', 'super_admin', 'departments', 'positions', 'review'],
        currentSection: 'review',
        sectionStatuses: {
          organization: 'completed',
          super_admin: 'completed',
          departments: 'completed',
          positions: 'completed',
          review: 'completed'
        },
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
        schemaVersion: 2
      }),
      { merge: true }
    );

    await batch.commit();

    // Verify launch persistence
    const [verifiedOrgSnap, verifiedConfigSnap] = await Promise.all([
      fetchDocVerified(orgRef),
      fetchDocVerified(configRef)
    ]);

    if (!verifiedConfigSnap.exists() || !(verifiedConfigSnap.data() as SystemConfig).initialized) {
      throw new Error('Launch verification failed: system/config is not marked initialized.');
    }

    return {
      organization: verifiedOrgSnap.data() as Organization,
      systemConfig: verifiedConfigSnap.data() as SystemConfig,
      superAdmin
    };
  },

  // Detect and prevent circular reporting relationships in the hierarchy
  detectReportingCycle(positions: Position[], positionId: string, proposedParentId: string | null): boolean {
    if (!proposedParentId) return false;
    if (positionId === proposedParentId) return true;

    const visited = new Set<string>([positionId]);
    let currentId: string | null | undefined = proposedParentId;

    while (currentId) {
      if (visited.has(currentId)) {
        return true;
      }
      visited.add(currentId);
      const parentPos = positions.find(p => p.id === currentId);
      currentId = parentPos?.parentPositionId;
    }

    return false;
  }
};
