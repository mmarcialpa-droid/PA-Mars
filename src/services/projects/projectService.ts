import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  increment,
  query,
  where,
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { Project, ProjectMember } from '../../types';

export const projectService = {
  // Get all accessible projects
  async getAllProjects(): Promise<Project[]> {
    const path = 'projects';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Get single project details
  async getProjectDetails(projectId: string): Promise<Project | null> {
    const path = `projects/${projectId}`;
    try {
      const snap = await getDoc(doc(db, 'projects', projectId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Project;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Get project members subcollection
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const path = `projects/${projectId}/members`;
    try {
      const snap = await getDocs(collection(db, 'projects', projectId, 'members'));
      return snap.docs.map(d => d.data() as ProjectMember);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Listen to project members subcollection in real time
  listenToProjectMembers(projectId: string, callback: (members: ProjectMember[]) => void): Unsubscribe {
    const path = `projects/${projectId}/members`;
    return onSnapshot(
      collection(db, 'projects', projectId, 'members'),
      (snapshot) => {
        const members = snapshot.docs.map(d => ({ userId: d.id, ...d.data() } as ProjectMember));
        callback(members);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  },

  // Create new project atomically with nested member, userProjects index, and statistics
  async createProject(data: Partial<Project>, creatorId: string): Promise<Project> {
    const projectId = data.id || `proj_${Date.now()}`;
    const now = new Date().toISOString();

    const newProject: Project = sanitizeForFirestore({
      id: projectId,
      organizationId: data.organizationId || 'org_mars_default',
      name: data.name || 'Untitled Project',
      description: data.description || '',
      ownerId: creatorId,
      departmentId: data.departmentId ?? null,
      status: data.status || 'active',
      visibility: data.visibility || 'public',
      color: data.color || '#0284c7',
      category: data.category || 'Product Engineering',
      targetDate: data.targetDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      createdAt: now,
      updatedAt: now
    });

    try {
      const batch = writeBatch(db);

      // 1. Write Project document
      batch.set(doc(db, 'projects', projectId), newProject);

      // 2. Add creator to /projects/{projectId}/members/{creatorId}
      const memberData: ProjectMember = {
        userId: creatorId,
        role: 'project_admin',
        joinedAt: now
      };
      batch.set(doc(db, 'projects', projectId, 'members', creatorId), memberData);

      // 3. Write denormalized index /userProjects/{creatorId}/items/{projectId}
      batch.set(doc(db, 'userProjects', creatorId, 'items', projectId), {
        projectId,
        role: 'project_admin',
        projectName: newProject.name,
        projectStatus: newProject.status,
        lastActivityAt: now
      });

      // 4. Initialize project statistics
      batch.set(doc(db, 'projectStatistics', projectId), {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        forRevisionTasks: 0,
        forApprovalTasks: 0,
        overdueTasks: 0,
        totalMembers: 1,
        completionPercentage: 0,
        avgTurnaroundHours: 0,
        updatedAt: now
      });

      await batch.commit();
      return newProject;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}`);
    }
  },

  // Update project
  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const path = `projects/${projectId}`;
    try {
      await updateDoc(doc(db, 'projects', projectId), sanitizeForFirestore({
        ...updates,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Delete project
  async deleteProject(projectId: string): Promise<void> {
    const path = `projects/${projectId}`;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Add or update member in project
  async addProjectMember(projectId: string, userId: string, role: ProjectMember['role']): Promise<void> {
    const path = `projects/${projectId}/members/${userId}`;
    const now = new Date().toISOString();
    try {
      const memberRef = doc(db, 'projects', projectId, 'members', userId);
      const existingSnap = await getDoc(memberRef);
      const isNewMember = !existingSnap.exists();

      const batch = writeBatch(db);
      batch.set(memberRef, {
        userId,
        role,
        joinedAt: existingSnap.exists() ? (existingSnap.data().joinedAt || now) : now
      });

      const projDoc = await getDoc(doc(db, 'projects', projectId));
      if (projDoc.exists()) {
        const pData = projDoc.data() as Project;
        batch.set(doc(db, 'userProjects', userId, 'items', projectId), {
          projectId,
          role,
          projectName: pData.name,
          projectStatus: pData.status,
          lastActivityAt: now
        });
      }

      if (isNewMember) {
        batch.set(doc(db, 'projectStatistics', projectId), {
          totalMembers: increment(1),
          updatedAt: now
        }, { merge: true });
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Remove member from project
  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const path = `projects/${projectId}/members/${userId}`;
    const now = new Date().toISOString();
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'projects', projectId, 'members', userId));
      batch.delete(doc(db, 'userProjects', userId, 'items', projectId));
      batch.set(doc(db, 'projectStatistics', projectId), {
        totalMembers: increment(-1),
        updatedAt: now
      }, { merge: true });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Listen to accessible project updates cleanly compatible with strict Firestore list rules
  listenToProjects(
    options: { userId: string; isAdmin: boolean; departmentId?: string | null },
    callback: (projects: Project[]) => void
  ): Unsubscribe {
    const path = 'projects';
    if (options.isAdmin) {
      return onSnapshot(
        collection(db, path),
        (snapshot) => {
          const projs = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Project))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          callback(projs);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, path);
        }
      );
    }

    const publicMap = new Map<string, Project>();
    const ownedMap = new Map<string, Project>();
    const deptMap = new Map<string, Project>();
    const memberMap = new Map<string, Project>();
    const memberDocUnsubs = new Map<string, Unsubscribe>();
    const unsubs: Unsubscribe[] = [];

    const emitMerged = () => {
      const merged = new Map<string, Project>();
      publicMap.forEach((v, k) => merged.set(k, v));
      deptMap.forEach((v, k) => merged.set(k, v));
      ownedMap.forEach((v, k) => merged.set(k, v));
      memberMap.forEach((v, k) => merged.set(k, v));
      const sorted = Array.from(merged.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      callback(sorted);
    };

    // 1. Public projects
    unsubs.push(
      onSnapshot(
        query(collection(db, path), where('visibility', '==', 'public')),
        (snapshot) => {
          publicMap.clear();
          snapshot.docs.forEach(d => publicMap.set(d.id, { id: d.id, ...d.data() } as Project));
          emitMerged();
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, path);
        }
      )
    );

    // 2. Projects owned by user
    unsubs.push(
      onSnapshot(
        query(collection(db, path), where('ownerId', '==', options.userId)),
        (snapshot) => {
          ownedMap.clear();
          snapshot.docs.forEach(d => ownedMap.set(d.id, { id: d.id, ...d.data() } as Project));
          emitMerged();
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, path);
        }
      )
    );

    // 3. Department-scoped projects (if user belongs to a department)
    if (options.departmentId) {
      unsubs.push(
        onSnapshot(
          query(
            collection(db, path),
            where('visibility', '==', 'department'),
            where('departmentId', '==', options.departmentId)
          ),
          (snapshot) => {
            deptMap.clear();
            snapshot.docs.forEach(d => deptMap.set(d.id, { id: d.id, ...d.data() } as Project));
            emitMerged();
          },
          (error) => {
            console.warn('Department projects listener warning:', error);
          }
        )
      );
    }

    // 4. Projects via userProjects membership index (supports private invited projects)
    unsubs.push(
      onSnapshot(
        collection(db, 'userProjects', options.userId, 'items'),
        (snapshot) => {
          const nextIds = new Set(snapshot.docs.map(d => d.id));

          // Remove old per-doc listeners
          memberDocUnsubs.forEach((unsub, pid) => {
            if (!nextIds.has(pid)) {
              unsub();
              memberDocUnsubs.delete(pid);
              memberMap.delete(pid);
            }
          });

          // Attach per-doc listeners for newly joined projects
          nextIds.forEach((pid) => {
            if (memberDocUnsubs.has(pid)) return;
            const docUnsub = onSnapshot(
              doc(db, 'projects', pid),
              (projSnap) => {
                if (projSnap.exists()) {
                  memberMap.set(pid, { id: projSnap.id, ...projSnap.data() } as Project);
                } else {
                  memberMap.delete(pid);
                }
                emitMerged();
              },
              (err) => {
                console.warn(`Project doc listener (${pid}) ended:`, err?.message);
                memberMap.delete(pid);
                emitMerged();
              }
            );
            memberDocUnsubs.set(pid, docUnsub);
          });

          if (nextIds.size === 0) {
            emitMerged();
          }
        },
        (error) => {
          console.warn('userProjects index listener warning:', error);
        }
      )
    );

    return () => {
      unsubs.forEach(u => u());
      memberDocUnsubs.forEach(u => u());
      memberDocUnsubs.clear();
    };
  }
};
