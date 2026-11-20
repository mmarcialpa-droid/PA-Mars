import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Building2,
  ShieldCheck,
  Layers,
  Briefcase,
  Rocket,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Upload,
  Plus,
  Edit2,
  Trash2,
  Power,
  Search,
  LogOut,
  ArrowRight,
  Lock,
  Mail,
  Phone,
  MapPin,
  Globe,
  Loader2,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { organizationService, AuthoritativeSetupState } from '../../services/organization/organizationService';
import {
  Department,
  Position,
  SetupSectionKey,
  SectionSaveState
} from '../../types';

interface OrganizationSetupDashboardProps {
  onCompleted: () => void;
  onBackToLogin?: () => void;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (America/New_York)' },
  { value: 'America/Chicago', label: 'Central Time (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (America/Los_Angeles)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  { value: 'Europe/London', label: 'London Time (Europe/London)' },
  { value: 'Asia/Manila', label: 'Philippine Time (Asia/Manila)' },
  { value: 'Asia/Tokyo', label: 'Japan Time (Asia/Tokyo)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (Asia/Singapore)' },
  { value: 'Australia/Sydney', label: 'Sydney Time (Australia/Sydney)' }
];

const LEVEL_LABELS: Record<number, string> = {
  10: 'Level 10 — Executive / C-Suite',
  9: 'Level 9 — VP / Principal Director',
  8: 'Level 8 — Department Head / Director',
  7: 'Level 7 — Senior Manager / Principal Lead',
  6: 'Level 6 — Team Leader / Manager',
  5: 'Level 5 — Senior Professional',
  4: 'Level 4 — Mid-Level Specialist',
  3: 'Level 3 — Associate Professional',
  2: 'Level 2 — Junior Staff',
  1: 'Level 1 — Entry Level / Trainee'
};

type SaveBannerState = 'idle' | 'saving' | 'saved' | 'error' | 'unsaved';

export const OrganizationSetupDashboard: React.FC<OrganizationSetupDashboardProps> = ({
  onCompleted,
  onBackToLogin
}) => {
  const {
    firebaseUser,
    currentUser,
    systemConfig,
    organization,
    departments,
    positions,
    roles,
    allUsers,
    isSuperAdmin,
    isAdmin,
    signInWithEmail,
    registerWithEmail,
    signOut,
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
    refreshOrgData,
    showToast
  } = useApp();

  // Active dashboard section (non-sequential: jump anywhere)
  const [activeSection, setActiveSection] = useState<SetupSectionKey>(
    systemConfig.currentSection || 'organization'
  );

  // Global save indicator state
  const [saveBannerState, setSaveBannerState] = useState<SaveBannerState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(systemConfig.updatedAt || null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);

  // Authorization check for Firestore writes during setup
  const isAuthorizedSetupAdmin = Boolean(
    firebaseUser && (
      firebaseUser.email?.toLowerCase() === 'mmarcialpa@gmail.com' ||
      isSuperAdmin ||
      isAdmin ||
      (systemConfig.superAdminId && systemConfig.superAdminId === firebaseUser.uid)
    )
  );

  // ============================================================================
  // SECTION 1 STATE: Organization Information
  // ============================================================================
  const [orgName, setOrgName] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [orgEditMode, setOrgEditMode] = useState(true);
  const [orgDirty, setOrgDirty] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [logoUploadPct, setLogoUploadPct] = useState<number | null>(null);
  const orgHydratedRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (organization && !orgDirty) {
      const hydrationKey = `${organization.id}_${organization.updatedAt}`;
      if (orgHydratedRef.current !== hydrationKey) {
        orgHydratedRef.current = hydrationKey;
        const isDraftPlaceholder = organization.name === 'MARS Workspace (Draft)';
        setOrgName(isDraftPlaceholder ? '' : (organization.name || ''));
        setOrgLogoUrl(organization.logoUrl || '');
        setCompanyEmail(organization.companyEmail || '');
        setContactNumber(organization.contactNumber || '');
        setOfficeAddress(organization.officeAddress || '');
        setOrgDescription(organization.description || '');
        setTimezone(organization.timezone || 'America/New_York');
        setOrgEditMode(isDraftPlaceholder || !organization.name);
      }
    }
  }, [organization, orgDirty]);

  // ============================================================================
  // SECTION 2 STATE: Super Administrator
  // ============================================================================
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('mmarcialpa@gmail.com');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthMode, setAdminAuthMode] = useState<'email_create' | 'email_signin'>('email_create');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminDirty, setAdminDirty] = useState(false);

  const persistedSuperAdmin = useMemo(() => {
    if (systemConfig.superAdminId) {
      const found = allUsers.find((u) => u.id === systemConfig.superAdminId);
      if (found) return found;
    }
    if (currentUser?.roleIds?.includes('role_super_admin')) return currentUser;
    return null;
  }, [systemConfig.superAdminId, allUsers, currentUser]);

  useEffect(() => {
    if (adminDirty) return;
    if (persistedSuperAdmin) {
      setAdminFirstName(persistedSuperAdmin.firstName || '');
      setAdminLastName(persistedSuperAdmin.lastName || '');
      setAdminEmail(persistedSuperAdmin.email || 'mmarcialpa@gmail.com');
    } else if (firebaseUser && isAuthorizedSetupAdmin) {
      const parts = (firebaseUser.displayName || '').trim().split(/\s+/);
      setAdminFirstName(parts[0] || '');
      setAdminLastName(parts.slice(1).join(' ') || '');
      setAdminEmail(firebaseUser.email || 'mmarcialpa@gmail.com');
    }
  }, [persistedSuperAdmin, firebaseUser, isAuthorizedSetupAdmin, adminDirty]);

  // ============================================================================
  // SECTION 3 STATE: Departments
  // ============================================================================
  const [deptSearch, setDeptSearch] = useState('');
  const [deptStatusFilter, setDeptStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptNameInput, setDeptNameInput] = useState('');
  const [deptDescInput, setDeptDescInput] = useState('');
  const [deptParentInput, setDeptParentInput] = useState<string>('');
  const [deptHeadInput, setDeptHeadInput] = useState<string>('');
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [confirmDeleteDeptId, setConfirmDeleteDeptId] = useState<string | null>(null);

  // ============================================================================
  // SECTION 4 STATE: Positions & Designations
  // ============================================================================
  const [posSearch, setPosSearch] = useState('');
  const [posDeptFilter, setPosDeptFilter] = useState<string>('all');
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [posTitleInput, setPosTitleInput] = useState('');
  const [posDeptInput, setPosDeptInput] = useState<string>('');
  const [posLevelInput, setPosLevelInput] = useState<number>(5);
  const [posParentInput, setPosParentInput] = useState<string>('');
  const [posDescInput, setPosDescInput] = useState('');
  const [posSaving, setPosSaving] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);
  const [confirmDeletePosId, setConfirmDeletePosId] = useState<string | null>(null);

  useEffect(() => {
    if (!posDeptInput && departments.length > 0 && !editingPos) {
      const firstActive = departments.find((d) => d.status === 'active') || departments[0];
      if (firstActive) setPosDeptInput(firstActive.id);
    }
  }, [departments, posDeptInput, editingPos]);

  // ============================================================================
  // SECTION 5 STATE: Review & Launch (Authoritative Firestore Verification)
  // ============================================================================
  const [authStateSnapshot, setAuthStateSnapshot] = useState<AuthoritativeSetupState | null>(null);
  const [verifyingSnapshot, setVerifyingSnapshot] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const loadAuthoritativeSnapshot = useCallback(async () => {
    setVerifyingSnapshot(true);
    setLaunchError(null);
    try {
      const state = await organizationService.getAuthoritativeSetupState(
        organization?.id || systemConfig.organizationId
      );
      setAuthStateSnapshot(state);
    } catch (err: unknown) {
      setLaunchError(err instanceof Error ? err.message : 'Unable to fetch verification snapshot from Firestore.');
    } finally {
      setVerifyingSnapshot(false);
    }
  }, [organization?.id, systemConfig.organizationId]);

  useEffect(() => {
    if (activeSection === 'review') {
      loadAuthoritativeSnapshot();
    }
  }, [activeSection, loadAuthoritativeSnapshot]);

  // Helper to update section navigation & persist currentSection in Firestore when authorized
  const handleSelectSection = (section: SetupSectionKey) => {
    setActiveSection(section);
    if (isAuthorizedSetupAdmin && !systemConfig.initialized) {
      updateSetupProgress({ currentSection: section }).catch(() => {});
    }
  };

  // ============================================================================
  // SECTION 1 ACTIONS: Save & Debounced Auto-Save
  // ============================================================================
  const performSaveOrganization = useCallback(async () => {
    setOrgError(null);
    setGlobalError(null);

    if (!isAuthorizedSetupAdmin) {
      const msg = 'Please authenticate as the Super Administrator (mmarcialpa@gmail.com) first to save to Firestore.';
      setOrgError(msg);
      setSaveBannerState('error');
      return;
    }

    if (!orgName.trim()) {
      setOrgError('Organization Name is required.');
      setSaveBannerState('error');
      return;
    }

    setOrgSaving(true);
    setSaveBannerState('saving');
    setRetryAction(null);

    try {
      const res = await saveSetupOrganization({
        name: orgName.trim(),
        logoUrl: orgLogoUrl.trim(),
        companyEmail: companyEmail.trim(),
        contactNumber: contactNumber.trim(),
        officeAddress: officeAddress.trim(),
        description: orgDescription.trim(),
        timezone
      });

      setOrgDirty(false);
      setOrgEditMode(false);
      setLastSavedAt(res.organization.updatedAt);
      setSaveBannerState('saved');
      showToast('success', 'Organization information saved and verified in Firestore.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save organization information.';
      setOrgError(msg);
      setGlobalError(msg);
      setSaveBannerState('error');
      setRetryAction(() => performSaveOrganization);
    } finally {
      setOrgSaving(false);
    }
  }, [
    isAuthorizedSetupAdmin,
    orgName,
    orgLogoUrl,
    companyEmail,
    contactNumber,
    officeAddress,
    orgDescription,
    timezone,
    saveSetupOrganization,
    showToast
  ]);

  // Gentle auto-save only when already saved once (not placeholder draft), valid, dirty, and authorized
  useEffect(() => {
    const hasRealSavedOrg = Boolean(
      organization?.id &&
      organization.name &&
      organization.name !== 'MARS Workspace (Draft)'
    );
    if (!hasRealSavedOrg || !orgDirty || !orgName.trim() || !isAuthorizedSetupAdmin || orgSaving) {
      return;
    }

    const timer = window.setTimeout(() => {
      performSaveOrganization();
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [organization, orgDirty, orgName, isAuthorizedSetupAdmin, orgSaving, performSaveOrganization]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAuthorizedSetupAdmin) {
      setOrgError('Please sign in as an authorized administrator before uploading a logo.');
      return;
    }

    setOrgError(null);
    setLogoUploadPct(0);
    try {
      const targetOrgId = organization?.id || systemConfig.organizationId || 'draft_org';
      const url = await uploadOrganizationLogo(targetOrgId, file, (pct) => setLogoUploadPct(pct));
      setOrgLogoUrl(url);
      setOrgDirty(true);
      setSaveBannerState('unsaved');
      showToast('success', 'Logo uploaded. Save changes to persist logo URL.');
    } catch (err: unknown) {
      setOrgError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setLogoUploadPct(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ============================================================================
  // SECTION 2 ACTIONS: Auth & Save Super Administrator (Email & Password Only)
  // ============================================================================
  const isSignedInAsTargetAdmin = Boolean(
    firebaseUser &&
    firebaseUser.email?.toLowerCase() === adminEmail.trim().toLowerCase()
  );

  const handleSaveSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setGlobalError(null);

    if (!adminFirstName.trim() || !adminEmail.trim()) {
      setAdminError('First Name and Work Email are required.');
      return;
    }

    setAdminSaving(true);
    setSaveBannerState('saving');
    setRetryAction(null);

    try {
      // Authenticate via Email/Password if not already signed in as this account
      if (!isSignedInAsTargetAdmin) {
        if (adminAuthMode === 'email_create') {
          if (!adminPassword || adminPassword.length < 8) {
            throw new Error('Please enter a password of at least 8 characters to create the Super Admin Firebase Auth account.');
          }
          await registerWithEmail(adminEmail.trim(), adminPassword, {
            firstName: adminFirstName.trim(),
            lastName: adminLastName.trim(),
            name: `${adminFirstName.trim()} ${adminLastName.trim()}`.trim()
          });
          setAdminPassword('');
        } else {
          if (!adminPassword) {
            throw new Error('Please enter your password to sign in.');
          }
          await signInWithEmail(adminEmail.trim(), adminPassword);
          setAdminPassword('');
        }
      }

      const res = await saveSetupSuperAdmin({
        firstName: adminFirstName.trim(),
        lastName: adminLastName.trim(),
        email: adminEmail.trim()
      });

      setAdminDirty(false);
      setLastSavedAt(res.superAdminUser.updatedAt);
      setSaveBannerState('saved');
      showToast('success', 'Super Administrator account saved and verified in Firestore.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save Super Administrator.';
      setAdminError(msg);
      setGlobalError(msg);
      setSaveBannerState('error');
    } finally {
      setAdminSaving(false);
    }
  };

  // ============================================================================
  // SECTION 3 ACTIONS: Departments CRUD & Safe Delete
  // ============================================================================
  const activeOrgId = organization?.id || systemConfig.organizationId;

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    setGlobalError(null);

    if (!isAuthorizedSetupAdmin) {
      setDeptError('Please authenticate as Super Administrator before managing departments.');
      return;
    }
    if (!activeOrgId) {
      setDeptError('Please save Section 1 (Organization Information) or Section 2 (Super Admin) first so your organization ID exists.');
      return;
    }
    if (!deptNameInput.trim()) {
      setDeptError('Department name is required.');
      return;
    }

    setDeptSaving(true);
    setSaveBannerState('saving');
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, {
          name: deptNameInput.trim(),
          description: deptDescInput.trim(),
          parentDepartmentId: deptParentInput || null,
          headUserId: deptHeadInput || null,
          departmentHeadId: deptHeadInput || null
        });
      } else {
        await createDepartment({
          name: deptNameInput.trim(),
          description: deptDescInput.trim(),
          parentDepartmentId: deptParentInput || null,
          headUserId: deptHeadInput || null,
          departmentHeadId: deptHeadInput || null,
          status: 'active'
        });
      }

      setEditingDept(null);
      setDeptNameInput('');
      setDeptDescInput('');
      setDeptParentInput('');
      setDeptHeadInput('');
      setLastSavedAt(new Date().toISOString());
      setSaveBannerState('saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save department.';
      setDeptError(msg);
      setGlobalError(msg);
      setSaveBannerState('error');
    } finally {
      setDeptSaving(false);
    }
  };

  const handleToggleDepartmentStatus = async (dept: Department) => {
    setDeptError(null);
    setSaveBannerState('saving');
    try {
      const nextStatus = dept.status === 'active' ? 'archived' : 'active';
      await updateDepartment(dept.id, { status: nextStatus });
      setLastSavedAt(new Date().toISOString());
      setSaveBannerState('saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update department status.';
      setDeptError(msg);
      setSaveBannerState('error');
    }
  };

  const handleConfirmDeleteDepartment = async (deptId: string) => {
    setDeptError(null);
    setSaveBannerState('saving');
    try {
      await deleteDepartment(deptId);
      setConfirmDeleteDeptId(null);
      setLastSavedAt(new Date().toISOString());
      setSaveBannerState('saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not delete department.';
      setDeptError(msg);
      setConfirmDeleteDeptId(null);
      setSaveBannerState('error');
    }
  };

  // ============================================================================
  // SECTION 4 ACTIONS: Positions & Designations CRUD & Safe Delete
  // ============================================================================
  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosError(null);
    setGlobalError(null);

    if (!isAuthorizedSetupAdmin) {
      setPosError('Please authenticate as Super Administrator before managing positions.');
      return;
    }
    if (!activeOrgId) {
      setPosError('Please save Organization Information or Super Administrator first.');
      return;
    }
    if (!posTitleInput.trim()) {
      setPosError('Position title is required.');
      return;
    }

    if (editingPos && posParentInput) {
      if (organizationService.detectReportingCycle(positions, editingPos.id, posParentInput)) {
        setPosError('Circular reporting detected! A position cannot report to itself or a subordinate position.');
        return;
      }
    }

    setPosSaving(true);
    setSaveBannerState('saving');
    try {
      if (editingPos) {
        await updatePosition(editingPos.id, {
          title: posTitleInput.trim(),
          departmentId: posDeptInput || null,
          level: Number(posLevelInput),
          organizationalLevel: Number(posLevelInput),
          parentPositionId: posParentInput || null,
          description: posDescInput.trim()
        });
      } else {
        await createPosition({
          title: posTitleInput.trim(),
          departmentId: posDeptInput || null,
          level: Number(posLevelInput),
          organizationalLevel: Number(posLevelInput),
          parentPositionId: posParentInput || null,
          description: posDescInput.trim(),
          status: 'active'
        });
      }

      setEditingPos(null);
      setPosTitleInput('');
      setPosLevelInput(5);
      setPosParentInput('');
      setPosDescInput('');
      setLastSavedAt(new Date().toISOString());
      setSaveBannerState('saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save position.';
      setPosError(msg);
      setGlobalError(msg);
      setSaveBannerState('error');
    } finally {
      setPosSaving(false);
    }
  };

  const handleTogglePositionStatus = async (pos: Position) => {
    setPosError(null);
    setSaveBannerState('saving');
    try {
      const nextStatus = pos.status === 'active' ? 'archived' : 'active';
      await updatePosition(pos.id, { status: nextStatus });
      setLastSavedAt(new Date().toISOString());
      setSaveBannerState('saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update position status.';
      setPosError(msg);
      setSaveBannerState('error');
    }
  };

  const handleConfirmDeletePosition = async (posId: string) => {
    setPosError(null);
    setSaveBannerState('saving');
    try {
      await deletePosition(posId);
      setConfirmDeletePosId(null);
      setLastSavedAt(new Date().toISOString());
      setSaveBannerState('saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not delete position.';
      setPosError(msg);
      setConfirmDeletePosId(null);
      setSaveBannerState('error');
    }
  };

  // ============================================================================
  // SECTION 5 ACTIONS: Launch Organization
  // ============================================================================
  const handleLaunch = async () => {
    setLaunchError(null);
    setLaunching(true);
    setSaveBannerState('saving');
    try {
      await launchOrganization();
      setSaveBannerState('saved');
      onCompleted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Organization launch failed.';
      setLaunchError(msg);
      setSaveBannerState('error');
    } finally {
      setLaunching(false);
    }
  };

  // ============================================================================
  // DERIVED SECTION STATUSES & FILTERS
  // ============================================================================
  const sectionStatuses = useMemo((): Record<SetupSectionKey, SectionSaveState> => {
    const orgComplete = Boolean(
      organization?.id &&
      organization.name &&
      organization.name !== 'MARS Workspace (Draft)' &&
      organization.timezone
    );
    const adminComplete = Boolean(
      persistedSuperAdmin &&
      persistedSuperAdmin.roleIds?.includes('role_super_admin') &&
      persistedSuperAdmin.accountStatus === 'active'
    );
    const deptsComplete = departments.some((d) => d.status === 'active');
    const posComplete = positions.some((p) => p.status === 'active');

    return {
      organization: orgError
        ? 'error'
        : orgDirty
        ? 'in_progress'
        : orgComplete
        ? 'completed'
        : systemConfig.sectionStatuses?.organization || 'not_started',
      super_admin: adminError
        ? 'error'
        : adminDirty
        ? 'in_progress'
        : adminComplete
        ? 'completed'
        : systemConfig.sectionStatuses?.super_admin || 'not_started',
      departments: deptError
        ? 'error'
        : deptsComplete
        ? 'completed'
        : departments.length > 0
        ? 'in_progress'
        : systemConfig.sectionStatuses?.departments || 'not_started',
      positions: posError
        ? 'error'
        : posComplete
        ? 'completed'
        : positions.length > 0
        ? 'in_progress'
        : systemConfig.sectionStatuses?.positions || 'not_started',
      review: systemConfig.initialized
        ? 'completed'
        : orgComplete && adminComplete && deptsComplete && posComplete
        ? 'saved'
        : 'not_started'
    };
  }, [
    organization,
    persistedSuperAdmin,
    departments,
    positions,
    orgError,
    orgDirty,
    adminError,
    adminDirty,
    deptError,
    posError,
    systemConfig
  ]);

  const completedCoreCount = (['organization', 'super_admin', 'departments', 'positions'] as SetupSectionKey[]).filter(
    (k) => sectionStatuses[k] === 'completed'
  ).length;

  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (deptStatusFilter !== 'all' && d.status !== deptStatusFilter) return false;
      if (deptSearch.trim()) {
        const q = deptSearch.toLowerCase();
        return d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [departments, deptStatusFilter, deptSearch]);

  const filteredPositions = useMemo(() => {
    return positions
      .filter((p) => {
        if (posDeptFilter !== 'all' && p.departmentId !== posDeptFilter) return false;
        if (posSearch.trim()) {
          const q = posSearch.toLowerCase();
          return p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => b.level - a.level);
  }, [positions, posDeptFilter, posSearch]);

  // Verification checklist computed from authoritative snapshot when available (fallback to live state)
  const checklistData = useMemo(() => {
    const snapOrg = authStateSnapshot?.organization ?? organization;
    const snapAdmin = authStateSnapshot?.superAdmin ?? persistedSuperAdmin;
    const snapDepts = authStateSnapshot?.departments ?? departments;
    const snapPositions = authStateSnapshot?.positions ?? positions;
    const snapRoles = authStateSnapshot?.roles ?? roles;

    const orgOk = Boolean(snapOrg?.name && snapOrg.name !== 'MARS Workspace (Draft)' && snapOrg.timezone);
    const adminOk = Boolean(snapAdmin && snapAdmin.roleIds?.includes('role_super_admin') && snapAdmin.accountStatus === 'active');
    const deptsActive = snapDepts.filter((d) => d.status === 'active');
    const deptsOk = deptsActive.length > 0;
    const posActive = snapPositions.filter((p) => p.status === 'active');
    const deptIds = new Set(snapDepts.map((d) => d.id));
    const hasOrphanPos = posActive.some((p) => p.departmentId && !deptIds.has(p.departmentId));
    const posOk = posActive.length > 0 && !hasOrphanPos;
    const rolesOk = snapRoles.some((r) => r.id === 'role_super_admin');

    return {
      snapOrg,
      snapAdmin,
      snapDepts,
      deptsActive,
      snapPositions,
      posActive,
      snapRoles,
      orgOk,
      adminOk,
      deptsOk,
      posOk,
      rolesOk,
      hasOrphanPos,
      allReady: orgOk && adminOk && deptsOk && posOk && isAuthorizedSetupAdmin
    };
  }, [authStateSnapshot, organization, persistedSuperAdmin, departments, positions, roles, isAuthorizedSetupAdmin]);

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return 'Not saved yet';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  const renderStatusIndicator = (state: SectionSaveState) => {
    switch (state) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'saved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Saved</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <Clock className="w-3.5 h-3.5" />
            <span>In Progress</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Error</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Not Started</span>
          </span>
        );
    }
  };

  const navItems: {
    key: SetupSectionKey;
    label: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    meta?: string;
  }[] = [
    {
      key: 'organization',
      label: 'Organization Information',
      subtitle: 'Identity, contact & localization',
      icon: Building2
    },
    {
      key: 'super_admin',
      label: 'Super Administrator',
      subtitle: 'Firebase Auth & root access',
      icon: ShieldCheck
    },
    {
      key: 'departments',
      label: 'Departments',
      subtitle: 'Business units & hierarchy',
      icon: Layers,
      meta: `${departments.filter((d) => d.status === 'active').length} active`
    },
    {
      key: 'positions',
      label: 'Positions & Designations',
      subtitle: 'Job titles & reporting lines',
      icon: Briefcase,
      meta: `${positions.filter((p) => p.status === 'active').length} active`
    },
    {
      key: 'review',
      label: 'Review & Launch',
      subtitle: 'Verify Firestore & go live',
      icon: Rocket
    }
  ];

  return (
    <div className="min-h-screen w-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Persistent Top Header & Save Status Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-base shrink-0">
              M
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base font-bold font-display text-slate-900 tracking-tight">
                  Organization Setup Dashboard
                </h1>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-medium text-slate-600 font-mono-tabular">
                  {completedCoreCount}/4 sections completed
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Modular setup workspace — configure sections in any order. Each section persists directly to Cloud Firestore.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Persistent Save Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              {saveBannerState === 'saving' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-slate-700 animate-spin" />
                  <span className="font-semibold text-slate-700">Saving changes...</span>
                </>
              ) : saveBannerState === 'error' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="font-semibold text-rose-700">Unable to save.</span>
                  {retryAction && (
                    <button
                      type="button"
                      onClick={() => retryAction()}
                      className="underline font-bold text-rose-800 hover:no-underline ml-1"
                    >
                      Retry Save
                    </button>
                  )}
                </>
              ) : saveBannerState === 'unsaved' || orgDirty || adminDirty ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold text-amber-700">Unsaved changes</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-semibold text-slate-700">All changes saved</span>
                  {lastSavedAt && (
                    <span className="text-slate-400 font-mono-tabular">
                      · {formatTimestamp(lastSavedAt)}
                    </span>
                  )}
                </>
              )}
            </div>

            {firebaseUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectSection('super_admin')}
                  className="px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                >
                  Super Admin Auth
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    if (onBackToLogin) onBackToLogin();
                  }}
                  className="px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              onBackToLogin && (
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  Sign In Page
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-5">
        {/* Global Auth / Authorization Guard Banner */}
        {!firebaseUser ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Email & Password Authentication Required to Persist Setup</p>
                <p className="text-amber-800 mt-0.5">
                  Create or sign in with your Super Administrator Email & Password account (<strong>mmarcialpa@gmail.com</strong>) in Section 2 to enable live Cloud Firestore writes and resume any previously saved draft.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAdminAuthMode('email_signin');
                  handleSelectSection('super_admin');
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold"
              >
                Open Super Admin Login
              </button>
              {onBackToLogin && (
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="px-3 py-2 bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-950 rounded-lg font-semibold"
                >
                  Login Page
                </button>
              )}
            </div>
          </div>
        ) : !isAuthorizedSetupAdmin ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950">
                  Signed in as {firebaseUser.email} (Not Authorized for Setup)
                </p>
                <p className="text-rose-800 mt-0.5">
                  Cloud Firestore setup rules restrict organization initialization to the designated Super Administrator (<strong>mmarcialpa@gmail.com</strong>). Sign out and sign in with that account.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setAdminAuthMode('email_signin');
                handleSelectSection('super_admin');
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shrink-0"
            >
              Sign Out & Switch Account
            </button>
          </div>
        ) : null}

        {/* Global Error Banner */}
        {globalError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{globalError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {retryAction && (
                <button
                  type="button"
                  onClick={() => retryAction()}
                  className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded font-semibold"
                >
                  Retry Save
                </button>
              )}
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                className="p-1 text-rose-500 hover:text-rose-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Modular Dashboard Grid: Left Section Selector + Right Active Configuration Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Navigation Rail (Independent Non-Sequential Sections) */}
          <aside className="lg:col-span-4 space-y-3">
            <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.key;
                const status = sectionStatuses[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectSection(item.key)}
                    className={`w-full text-left p-3 rounded-lg transition-colors border ${
                      isActive
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-transparent hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isActive ? 'text-white' : 'text-slate-600'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{item.label}</div>
                          <div
                            className={`text-[11px] mt-0.5 truncate ${
                              isActive ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {item.subtitle}
                            {item.meta ? ` · ${item.meta}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isActive ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                            {status === 'completed' ? 'Done' : 'Active'}
                          </span>
                        ) : (
                          renderStatusIndicator(status)
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Firestore Record Summary Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Firestore Setup State</span>
                <button
                  type="button"
                  onClick={() => refreshOrgData()}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync</span>
                </button>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Organization ID</span>
                  <span className="font-mono-tabular text-slate-800 truncate max-w-[140px]">
                    {activeOrgId || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Super Admin UID</span>
                  <span className="font-mono-tabular text-slate-800 truncate max-w-[140px]">
                    {systemConfig.superAdminId || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Departments Saved</span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {departments.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Positions Saved</span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {positions.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>System Status</span>
                  <span className="font-semibold text-slate-900">
                    {systemConfig.initialized ? 'Active' : 'Setup In Progress'}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Configuration Panel */}
          <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-6">
            {/* =================================================================
                SECTION 1: ORGANIZATION INFORMATION
            ================================================================== */}
            {activeSection === 'organization' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-900">
                        Section 1: Organization Information
                      </h2>
                      {renderStatusIndicator(sectionStatuses.organization)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure company identity, logo, official contact details, and primary timezone.
                    </p>
                  </div>
                  {!orgEditMode && (
                    <button
                      type="button"
                      onClick={() => setOrgEditMode(true)}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Information</span>
                    </button>
                  )}
                </div>

                {orgError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between gap-2">
                    <span>{orgError}</span>
                    <button
                      type="button"
                      onClick={() => performSaveOrganization()}
                      className="px-2.5 py-1 bg-rose-700 text-white rounded font-semibold shrink-0"
                    >
                      Retry Save
                    </button>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    performSaveOrganization();
                  }}
                  className="space-y-4 text-xs"
                >
                  {/* Logo Preview & Upload Row */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {orgLogoUrl ? (
                        <img
                          src={orgLogoUrl}
                          alt="Organization Logo"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Building2 className="w-7 h-7 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="font-semibold text-slate-700">
                          Organization Logo (Upload or Image URL)
                        </label>
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={!orgEditMode || logoUploadPct !== null}
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 rounded-lg font-semibold text-slate-700 flex items-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>
                              {logoUploadPct !== null ? `Uploading ${logoUploadPct}%` : 'Upload Logo File'}
                            </span>
                          </button>
                        </div>
                      </div>
                      <input
                        type="url"
                        value={orgLogoUrl}
                        disabled={!orgEditMode}
                        onChange={(e) => {
                          setOrgLogoUrl(e.target.value);
                          setOrgDirty(true);
                          setSaveBannerState('unsaved');
                        }}
                        placeholder="https://company.com/assets/logo.png"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Organization Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!orgEditMode}
                        value={orgName}
                        onChange={(e) => {
                          setOrgName(e.target.value);
                          setOrgDirty(true);
                          setSaveBannerState('unsaved');
                        }}
                        placeholder="e.g. Acme Global Corporation"
                        className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Company Email
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="email"
                          disabled={!orgEditMode}
                          value={companyEmail}
                          onChange={(e) => {
                            setCompanyEmail(e.target.value);
                            setOrgDirty(true);
                            setSaveBannerState('unsaved');
                          }}
                          placeholder="hello@company.com"
                          className="w-full pl-8 pr-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Contact Number
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          disabled={!orgEditMode}
                          value={contactNumber}
                          onChange={(e) => {
                            setContactNumber(e.target.value);
                            setOrgDirty(true);
                            setSaveBannerState('unsaved');
                          }}
                          placeholder="+1 (555) 234-5678"
                          className="w-full pl-8 pr-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Office Address
                      </label>
                      <div className="relative">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          disabled={!orgEditMode}
                          value={officeAddress}
                          onChange={(e) => {
                            setOfficeAddress(e.target.value);
                            setOrgDirty(true);
                            setSaveBannerState('unsaved');
                          }}
                          placeholder="Suite 400, 100 Market St, San Francisco, CA"
                          className="w-full pl-8 pr-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Organization Description
                      </label>
                      <textarea
                        rows={2}
                        disabled={!orgEditMode}
                        value={orgDescription}
                        onChange={(e) => {
                          setOrgDescription(e.target.value);
                          setOrgDirty(true);
                          setSaveBannerState('unsaved');
                        }}
                        placeholder="Mission, operational focus, and workspace overview..."
                        className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Primary Timezone <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <select
                          disabled={!orgEditMode}
                          value={timezone}
                          onChange={(e) => {
                            setTimezone(e.target.value);
                            setOrgDirty(true);
                            setSaveBannerState('unsaved');
                          }}
                          className="w-full pl-8 pr-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500">
                      {organization?.id && organization.name !== 'MARS Workspace (Draft)'
                        ? `Persisted record ID: ${organization.id}`
                        : 'Save changes to create and verify your organization record in Firestore.'}
                    </div>
                    <div className="flex items-center gap-2">
                      {orgEditMode && (
                        <button
                          type="submit"
                          disabled={orgSaving || !orgName.trim() || !isAuthorizedSetupAdmin}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                        >
                          {orgSaving ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Saving & Verifying...</span>
                            </>
                          ) : (
                            <span>Save Changes</span>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSelectSection('super_admin')}
                        className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center gap-1"
                      >
                        <span>Super Admin</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* =================================================================
                SECTION 2: SUPER ADMINISTRATOR
            ================================================================== */}
            {activeSection === 'super_admin' && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-slate-900">
                      Section 2: Super Administrator Account
                    </h2>
                    {renderStatusIndicator(sectionStatuses.super_admin)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bind the root Super Administrator profile directly to a real Firebase Authentication UID. Passwords are never stored in Firestore.
                  </p>
                </div>

                {adminError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                    {adminError}
                  </div>
                )}

                {/* Firebase Email & Password Identity Block */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">Firebase Email & Password Authentication</p>
                      <p className="text-[11px] text-slate-500">
                        Designated primary administrator: <strong>mmarcialpa@gmail.com</strong>
                      </p>
                    </div>
                    {!isSignedInAsTargetAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAdminAuthMode('email_create')}
                          className={`px-2.5 py-1 rounded-lg font-semibold border ${
                            adminAuthMode === 'email_create'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Create Account
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminAuthMode('email_signin')}
                          className={`px-2.5 py-1 rounded-lg font-semibold border ${
                            adminAuthMode === 'email_signin'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Sign In Existing
                        </button>
                      </div>
                    )}
                  </div>

                  {isSignedInAsTargetAdmin && firebaseUser ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Authenticated: {firebaseUser.email}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-tabular">
                          UID: {firebaseUser.uid} · Email &amp; Password Auth Active
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => signOut()}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold"
                        >
                          Switch Account
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/70">
                      {adminAuthMode === 'email_create'
                        ? 'Enter your name, work email, and a strong password below to register your Super Administrator Firebase account.'
                        : 'Enter your Super Administrator email and password below to sign in to Firebase Authentication.'}
                    </p>
                  )}
                </div>

                <form onSubmit={handleSaveSuperAdmin} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        First Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={adminFirstName}
                        onChange={(e) => {
                          setAdminFirstName(e.target.value);
                          setAdminDirty(true);
                          setSaveBannerState('unsaved');
                        }}
                        placeholder="First Name"
                        className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={adminLastName}
                        onChange={(e) => {
                          setAdminLastName(e.target.value);
                          setAdminDirty(true);
                          setSaveBannerState('unsaved');
                        }}
                        placeholder="Last Name"
                        className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Work Email Address <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => {
                        setAdminEmail(e.target.value);
                        setAdminDirty(true);
                        setSaveBannerState('unsaved');
                      }}
                      className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  {!isSignedInAsTargetAdmin && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Firebase Auth Password <span className="text-rose-600">*</span>
                        </label>
                      </div>
                      <input
                        type="password"
                        required
                        minLength={adminAuthMode === 'email_create' ? 8 : 6}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder={
                          adminAuthMode === 'email_create'
                            ? 'Minimum 8 characters (stored securely in Firebase Auth)'
                            : 'Enter your Firebase Auth password'
                        }
                        className="w-full px-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  )}

                  {/* Read-Only Role & Status Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Assigned Role</span>
                      <span className="font-bold text-slate-900">Super Administrator</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Account Status</span>
                      <span className="font-bold text-emerald-700">Active</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Persisted Firestore Record</span>
                      <span className="font-mono-tabular text-slate-800 truncate block">
                        {persistedSuperAdmin ? `users/${persistedSuperAdmin.id}` : 'Not saved yet'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectSection('organization')}
                      className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-semibold"
                    >
                      Back to Organization
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={adminSaving || !adminFirstName.trim() || !adminEmail.trim()}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                      >
                        {adminSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving & Verifying...</span>
                          </>
                        ) : (
                          <span>Save & Verify Super Admin</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectSection('departments')}
                        className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center gap-1"
                      >
                        <span>Departments</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* =================================================================
                SECTION 3: DEPARTMENTS
            ================================================================== */}
            {activeSection === 'departments' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-900">
                        Section 3: Departments
                      </h2>
                      {renderStatusIndicator(sectionStatuses.departments)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create, edit, activate/deactivate, or safely delete organizational departments. Every action saves directly to Firestore.
                    </p>
                  </div>
                  <span className="text-xs font-mono-tabular font-semibold text-slate-600">
                    {departments.filter((d) => d.status === 'active').length} active · {departments.length} total
                  </span>
                </div>

                {!activeOrgId && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-3">
                    <span>
                      Save <strong>Organization Information</strong> or <strong>Super Administrator</strong> first to initialize your Firestore organization container.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectSection('organization')}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold shrink-0"
                    >
                      Go to Section 1
                    </button>
                  </div>
                )}

                {deptError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                    {deptError}
                  </div>
                )}

                {/* Add / Edit Department Form */}
                <form
                  onSubmit={handleSaveDepartment}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {editingDept ? `Editing Department: ${editingDept.name}` : 'Add Department'}
                    </span>
                    {editingDept && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDept(null);
                          setDeptNameInput('');
                          setDeptDescInput('');
                          setDeptParentInput('');
                          setDeptHeadInput('');
                          setDeptError(null);
                        }}
                        className="text-slate-500 hover:text-slate-800 font-medium"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Department Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={deptNameInput}
                        onChange={(e) => setDeptNameInput(e.target.value)}
                        placeholder="e.g. Engineering & Architecture"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Parent Department (Optional)
                      </label>
                      <select
                        value={deptParentInput}
                        onChange={(e) => setDeptParentInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="">None (Root Department)</option>
                        {departments
                          .filter((d) => !editingDept || d.id !== editingDept.id)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={deptDescInput}
                        onChange={(e) => setDeptDescInput(e.target.value)}
                        placeholder="Functional scope and responsibilities"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Department Head (Optional)
                      </label>
                      <select
                        value={deptHeadInput}
                        onChange={(e) => setDeptHeadInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="">Unassigned</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={deptSaving || !deptNameInput.trim() || !activeOrgId || !isAuthorizedSetupAdmin}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                    >
                      {deptSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>{editingDept ? 'Save Department Changes' : 'Add & Save Department'}</span>
                    </button>
                  </div>
                </form>

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                      placeholder="Search departments..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <select
                    value={deptStatusFilter}
                    onChange={(e) => setDeptStatusFilter(e.target.value as 'all' | 'active' | 'archived')}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="archived">Inactive / Archived</option>
                  </select>
                </div>

                {/* Departments List */}
                {filteredDepartments.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                    No departments saved yet. Add at least one active department above.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {filteredDepartments.map((dept) => {
                      const parent = departments.find((d) => d.id === dept.parentDepartmentId);
                      const isConfirmingDelete = confirmDeleteDeptId === dept.id;
                      return (
                        <div
                          key={dept.id}
                          className="p-3.5 bg-white hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{dept.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono-tabular">
                                · {dept.id}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  dept.status === 'active' ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                · {dept.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {dept.description || 'No description'}
                              {parent ? ` · Reports under ${parent.name}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                <span className="text-[11px] font-semibold text-rose-800">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteDepartment(dept.id)}
                                  className="px-2 py-0.5 bg-rose-700 text-white rounded text-[11px] font-semibold"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteDeptId(null)}
                                  className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded text-[11px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleDepartmentStatus(dept)}
                                  className="px-2.5 py-1 border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1"
                                >
                                  <Power className="w-3 h-3" />
                                  <span>{dept.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingDept(dept);
                                    setDeptNameInput(dept.name);
                                    setDeptDescInput(dept.description || '');
                                    setDeptParentInput(dept.parentDepartmentId || '');
                                    setDeptHeadInput(dept.headUserId || dept.departmentHeadId || '');
                                    setDeptError(null);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                                  title="Edit Department"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteDeptId(dept.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                  title="Delete Department"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectSection('super_admin')}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-semibold"
                  >
                    Back to Super Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSection('positions')}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold flex items-center gap-1.5"
                  >
                    <span>Positions & Designations</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* =================================================================
                SECTION 4: POSITIONS & DESIGNATIONS
            ================================================================== */}
            {activeSection === 'positions' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-900">
                        Section 4: Positions & Designations
                      </h2>
                      {renderStatusIndicator(sectionStatuses.positions)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Define job titles, assign them to saved departments, and establish reporting relationships.
                    </p>
                  </div>
                  <span className="text-xs font-mono-tabular font-semibold text-slate-600">
                    {positions.filter((p) => p.status === 'active').length} active · {positions.length} total
                  </span>
                </div>

                {!activeOrgId && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-3">
                    <span>
                      Save <strong>Organization Information</strong> or <strong>Super Administrator</strong> first to initialize your organization container.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectSection('organization')}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold shrink-0"
                    >
                      Go to Section 1
                    </button>
                  </div>
                )}

                {posError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                    {posError}
                  </div>
                )}

                {/* Add / Edit Position Form */}
                <form
                  onSubmit={handleSavePosition}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {editingPos ? `Editing Position: ${editingPos.title}` : 'Create Position'}
                    </span>
                    {editingPos && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPos(null);
                          setPosTitleInput('');
                          setPosLevelInput(5);
                          setPosParentInput('');
                          setPosDescInput('');
                          setPosError(null);
                        }}
                        className="text-slate-500 hover:text-slate-800 font-medium"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Position Title <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={posTitleInput}
                        onChange={(e) => setPosTitleInput(e.target.value)}
                        placeholder="e.g. Engineering Lead"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Assigned Department
                      </label>
                      <select
                        value={posDeptInput}
                        onChange={(e) => setPosDeptInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="">Cross-Departmental / Global</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.status !== 'active' ? '(Inactive)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Organizational Level (1–10)
                      </label>
                      <select
                        value={posLevelInput}
                        onChange={(e) => setPosLevelInput(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        {Object.entries(LEVEL_LABELS)
                          .sort((a, b) => Number(b[0]) - Number(a[0]))
                          .map(([lvl, label]) => (
                            <option key={lvl} value={Number(lvl)}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Reports To (Reporting Line)
                      </label>
                      <select
                        value={posParentInput}
                        onChange={(e) => setPosParentInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="">None (Top-Level / Independent)</option>
                        {positions
                          .filter((p) => !editingPos || p.id !== editingPos.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} (L{p.level})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Role Responsibilities / Notes
                    </label>
                    <input
                      type="text"
                      value={posDescInput}
                      onChange={(e) => setPosDescInput(e.target.value)}
                      placeholder="Key responsibilities and reporting expectations"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={posSaving || !posTitleInput.trim() || !activeOrgId || !isAuthorizedSetupAdmin}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                    >
                      {posSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>{editingPos ? 'Save Position Changes' : 'Add & Save Position'}</span>
                    </button>
                  </div>
                </form>

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={posSearch}
                      onChange={(e) => setPosSearch(e.target.value)}
                      placeholder="Search positions..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <select
                    value={posDeptFilter}
                    onChange={(e) => setPosDeptFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Positions List */}
                {filteredPositions.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                    No positions configured yet. Create at least one active position above.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {filteredPositions.map((pos) => {
                      const dept = departments.find((d) => d.id === pos.departmentId);
                      const parentPos = positions.find((p) => p.id === pos.parentPositionId);
                      const isConfirmingDelete = confirmDeletePosId === pos.id;
                      return (
                        <div
                          key={pos.id}
                          className="p-3.5 bg-white hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono-tabular font-bold text-slate-700">
                                L{pos.level}
                              </span>
                              <span className="font-bold text-slate-900">{pos.title}</span>
                              <span className="text-[11px] text-slate-500">
                                · {dept?.name || 'Cross-Departmental'}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  pos.status === 'active' ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                · {pos.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {parentPos ? `Reports to ${parentPos.title} (L${parentPos.level})` : 'Top-level / Independent'}
                              {pos.description ? ` · ${pos.description}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                <span className="text-[11px] font-semibold text-rose-800">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeletePosition(pos.id)}
                                  className="px-2 py-0.5 bg-rose-700 text-white rounded text-[11px] font-semibold"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePosId(null)}
                                  className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded text-[11px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePositionStatus(pos)}
                                  className="px-2.5 py-1 border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1"
                                >
                                  <Power className="w-3 h-3" />
                                  <span>{pos.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPos(pos);
                                    setPosTitleInput(pos.title);
                                    setPosDeptInput(pos.departmentId || '');
                                    setPosLevelInput(pos.level);
                                    setPosParentInput(pos.parentPositionId || '');
                                    setPosDescInput(pos.description || '');
                                    setPosError(null);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                                  title="Edit Position"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePosId(pos.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                  title="Delete Position"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectSection('departments')}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-semibold"
                  >
                    Back to Departments
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSection('review')}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold flex items-center gap-1.5"
                  >
                    <span>Review & Launch</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* =================================================================
                SECTION 5: REVIEW & LAUNCH
            ================================================================== */}
            {activeSection === 'review' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-900">
                        Section 5: Review & Launch Organization
                      </h2>
                      {renderStatusIndicator(sectionStatuses.review)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Live authoritative summary fetched directly from Cloud Firestore before activating your workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={verifyingSnapshot}
                    onClick={loadAuthoritativeSnapshot}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifyingSnapshot ? 'animate-spin' : ''}`} />
                    <span>{verifyingSnapshot ? 'Verifying...' : 'Refresh & Verify'}</span>
                  </button>
                </div>

                {authStateSnapshot && (
                  <div className="text-[11px] text-slate-500 font-mono-tabular">
                    Authoritative Firestore snapshot verified at {formatTimestamp(authStateSnapshot.verifiedAt)}
                  </div>
                )}

                {launchError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{launchError}</span>
                  </div>
                )}

                {/* Completeness Checklist */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                  <p className="font-bold text-slate-900">Pre-Launch Completeness Checklist</p>
                  {[
                    {
                      ok: checklistData.orgOk,
                      label: 'Organization Information saved (Name & Timezone)',
                      section: 'organization' as SetupSectionKey
                    },
                    {
                      ok: checklistData.adminOk,
                      label: 'Super Administrator verified with active Firebase Auth UID & role_super_admin',
                      section: 'super_admin' as SetupSectionKey
                    },
                    {
                      ok: checklistData.deptsOk,
                      label: `At least one active Department saved (${checklistData.deptsActive.length} active)`,
                      section: 'departments' as SetupSectionKey
                    },
                    {
                      ok: checklistData.posOk,
                      label: checklistData.hasOrphanPos
                        ? 'Position department reference mismatch detected'
                        : `At least one active Position saved (${checklistData.posActive.length} active)`,
                      section: 'positions' as SetupSectionKey
                    }
                  ].map((item) => (
                    <div
                      key={item.section}
                      className="flex items-center justify-between gap-2 py-1.5 border-b last:border-b-0 border-slate-200/70"
                    >
                      <div className="flex items-center gap-2">
                        {item.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span className={item.ok ? 'text-slate-800 font-medium' : 'text-amber-900 font-semibold'}>
                          {item.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectSection(item.section)}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline shrink-0"
                      >
                        {item.ok ? 'Edit' : 'Complete Now'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Authoritative Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Organization Profile</span>
                    </p>
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400">Name:</span>{' '}
                        <strong className="text-slate-900">{checklistData.snapOrg?.name || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Email:</span>{' '}
                        <span>{checklistData.snapOrg?.companyEmail || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Phone:</span>{' '}
                        <span>{checklistData.snapOrg?.contactNumber || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Timezone:</span>{' '}
                        <span className="font-mono-tabular">{checklistData.snapOrg?.timezone || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Super Administrator & Roles</span>
                    </p>
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400">Name:</span>{' '}
                        <strong className="text-slate-900">{checklistData.snapAdmin?.name || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Email:</span>{' '}
                        <span className="font-mono">{checklistData.snapAdmin?.email || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Auth UID:</span>{' '}
                        <span className="font-mono-tabular">{checklistData.snapAdmin?.id || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">System Roles:</span>{' '}
                        <span className="font-mono-tabular font-semibold">{checklistData.snapRoles.length} configured</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Launch Action Bar */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="text-[11px] text-slate-500">
                    Launching marks <code className="font-mono text-slate-700">system/config.initialized = true</code> and preserves all saved records without creating duplicates.
                  </div>

                  <button
                    type="button"
                    disabled={launching || !checklistData.allReady}
                    onClick={handleLaunch}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold flex items-center justify-center gap-2 shrink-0"
                  >
                    {launching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validating & Launching...</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        <span>Launch Organization</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
