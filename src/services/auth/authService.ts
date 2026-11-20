import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  User as FirebaseUser,
  Unsubscribe
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { PasswordRecoveryRequest, RegistrationRequest, User } from '../../types';

// Client-side sliding-window login failure tracker (defense-in-depth alongside backend check)
const CLIENT_LOGIN_LIMIT = 5;
const CLIENT_LOGIN_WINDOW_MS = 5 * 60 * 1000;
const clientLoginAttempts = new Map<string, number[]>();

function checkClientLoginLock(emailKey: string): void {
  const now = Date.now();
  const recent = (clientLoginAttempts.get(emailKey) || []).filter(
    (ts) => ts > now - CLIENT_LOGIN_WINDOW_MS
  );
  clientLoginAttempts.set(emailKey, recent);
  if (recent.length >= CLIENT_LOGIN_LIMIT) {
    const waitSec = Math.max(1, Math.ceil((recent[0] + CLIENT_LOGIN_WINDOW_MS - now) / 1000));
    throw new Error(
      `Too many failed sign-in attempts. For account protection, please wait ${waitSec}s before trying again.`
    );
  }
}

function recordClientLoginFailure(emailKey: string): void {
  const now = Date.now();
  const recent = (clientLoginAttempts.get(emailKey) || []).filter(
    (ts) => ts > now - CLIENT_LOGIN_WINDOW_MS
  );
  recent.push(now);
  clientLoginAttempts.set(emailKey, recent);
}

function mapEmailAuthError(error: any, context: 'login' | 'register' | 'password_change'): Error {
  const code = error?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return new Error(
      'Email/Password authentication is not yet enabled in Firebase Console for this project. Please ask your administrator to enable Email/Password under Firebase Console -> Authentication -> Sign-in method.'
    );
  }
  if (code === 'auth/invalid-email') {
    return new Error('Please enter a valid email address.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Network error while contacting Firebase Authentication. Check your internet connection and try again.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Too many attempts. Please wait a few minutes before trying again.');
  }
  if (code === 'auth/user-disabled') {
    return new Error('This account has been disabled by an administrator.');
  }

  if (context === 'login') {
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password'
    ) {
      return new Error('Invalid email or password. Please check your credentials and try again.');
    }
  }

  if (context === 'register') {
    if (code === 'auth/email-already-in-use') {
      return new Error('An account with this email address already exists. Please sign in or request password recovery.');
    }
    if (code === 'auth/weak-password') {
      return new Error('Password is too weak. Please use at least 8 characters with letters and numbers.');
    }
  }

  if (context === 'password_change') {
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return new Error('Your current password is incorrect.');
    }
    if (code === 'auth/weak-password') {
      return new Error('New password is too weak. Use at least 8 characters.');
    }
    if (code === 'auth/requires-recent-login') {
      return new Error('Please sign out and sign back in before changing your password.');
    }
  }

  return error instanceof Error ? error : new Error('Authentication request failed.');
}

export const authService = {
  // Sign in strictly with Firebase Email & Password (zero email verification gates)
  async signInWithEmail(email: string, pass: string, rememberMe = true): Promise<User | null> {
    const emailKey = email.trim().toLowerCase();
    checkClientLoginLock(emailKey);

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const result = await signInWithEmailAndPassword(auth, email.trim(), pass);

      // Clear throttles on valid credential authentication
      clientLoginAttempts.delete(emailKey);
      fetch('/api/auth/throttle-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: emailKey, clear: true })
      }).catch(() => {});

      const userDoc = await this.getUserProfile(result.user.uid);
      if (userDoc) {
        if (userDoc.accountStatus === 'suspended') {
          await firebaseSignOut(auth);
          throw new Error('This account has been suspended by an administrator. Please contact your organization.');
        }
        if (userDoc.accountStatus === 'rejected') {
          await firebaseSignOut(auth);
          const reasonSuffix = userDoc.rejectionReason ? ` Reason: ${userDoc.rejectionReason}` : '';
          throw new Error(`Your registration request was declined by an administrator.${reasonSuffix}`);
        }
        if (userDoc.accountStatus === 'archived') {
          await firebaseSignOut(auth);
          throw new Error('This account has been archived and can no longer access the workspace.');
        }
        return userDoc;
      }

      return await this.syncUserProfile(result.user);
    } catch (error: any) {
      const code = error?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        recordClientLoginFailure(emailKey);
        fetch('/api/auth/throttle-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', email: emailKey, recordAttempt: true })
        }).catch(() => {});
      }
      throw mapEmailAuthError(error, 'login');
    }
  },

  // Create Firebase Email/Password user for Super Admin setup or direct flows (no verification email sent)
  async registerWithEmail(
    email: string,
    pass: string,
    extraProfile?: Partial<User>
  ): Promise<User> {
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const displayName =
        extraProfile?.name ||
        `${extraProfile?.firstName || ''} ${extraProfile?.lastName || ''}`.trim() ||
        result.user.email?.split('@')[0] ||
        'User';
      if (displayName) {
        await updateProfile(result.user, { displayName }).catch(() => {});
      }

      const isOwnerEmail = result.user.email?.toLowerCase() === 'mmarcialpa@gmail.com';
      const synced = await this.syncUserProfile(result.user, {
        ...extraProfile,
        accountStatus: isOwnerEmail ? 'active' : extraProfile?.accountStatus || 'pending_approval'
      });
      if (!synced) {
        throw new Error('Could not initialize user profile in Firestore.');
      }
      return synced;
    } catch (error: any) {
      throw mapEmailAuthError(error, 'register');
    }
  },

  // Public self-registration: creates Firebase Auth user + /users/{uid} (pending_approval) + /registrationRequests/{id}
  async registerPublicAccount(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    employeeId?: string | null;
    organizationId: string;
    requestedDepartment?: string | null;
    termsAcceptedAt?: string;
  }): Promise<User> {
    try {
      const fullName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
      const result = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
      await updateProfile(result.user, { displayName: fullName }).catch(() => {});

      const now = new Date().toISOString();
      const normalizedEmail = (result.user.email || params.email).trim().toLowerCase();
      const cleanEmpId = params.employeeId?.trim() || null;
      const cleanDept = params.requestedDepartment?.trim() || null;

      const newUser: User = sanitizeForFirestore({
        id: result.user.uid,
        organizationId: params.organizationId,
        firstName: params.firstName.trim(),
        lastName: params.lastName.trim(),
        name: fullName,
        email: normalizedEmail,
        employeeId: cleanEmpId,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0f172a&color=fff`,
        departmentId: null,
        requestedDepartment: cleanDept,
        positionId: null,
        managerId: null,
        roleIds: ['role_member'],
        primaryRoleId: 'role_member',
        accountStatus: 'pending_approval',
        emailVerified: Boolean(result.user.emailVerified),
        termsAcceptedAt: params.termsAcceptedAt || now,
        dateJoined: now.split('T')[0],
        createdAt: now,
        updatedAt: now
      });

      const reqId = `reg_${result.user.uid}`;
      const regRequest: RegistrationRequest = sanitizeForFirestore({
        id: reqId,
        userId: result.user.uid,
        organizationId: params.organizationId,
        firstName: params.firstName.trim(),
        lastName: params.lastName.trim(),
        name: fullName,
        email: normalizedEmail,
        employeeId: cleanEmpId,
        requestedDepartment: cleanDept,
        registrationMethod: 'public_signup',
        invitedTokenHash: null,
        status: 'pending_approval',
        createdAt: now,
        updatedAt: now
      });

      await setDoc(doc(db, 'users', result.user.uid), newUser);
      await setDoc(doc(db, 'registrationRequests', reqId), regRequest).catch((err) => {
        console.warn('Non-blocking registrationRequests mirror write skipped:', err);
      });

      return newUser;
    } catch (error: any) {
      if (error?.code) {
        throw mapEmailAuthError(error, 'register');
      }
      throw error;
    }
  },

  // Create Firebase Auth email/password user cleanly (used during atomic invitation redemption)
  async createFirebaseEmailUser(
    email: string,
    pass: string,
    displayName?: string
  ): Promise<FirebaseUser> {
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (displayName?.trim()) {
        await updateProfile(result.user, { displayName: displayName.trim() }).catch(() => {});
      }
      return result.user;
    } catch (error: any) {
      throw mapEmailAuthError(error, 'register');
    }
  },

  // Administrator-Assisted Password Recovery Request (writes only identity info to Firestore; ZERO email services & ZERO passwords stored)
  async submitPasswordRecoveryRequest(params: {
    organizationId?: string | null;
    email: string;
    employeeId?: string | null;
    note?: string | null;
  }): Promise<PasswordRecoveryRequest> {
    const cleanEmail = params.email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter your registered email address.');
    }

    // Backend sliding-window throttle protection
    const throttleRes = await fetch('/api/auth/throttle-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recovery', email: cleanEmail, recordAttempt: true })
    }).catch(() => null);

    if (throttleRes && throttleRes.status === 429) {
      const data = await throttleRes.json().catch(() => ({}));
      throw new Error(data?.message || 'Too many recovery requests. Please wait a few minutes before submitting again.');
    }

    const now = new Date().toISOString();
    const requestId = `pwd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload: PasswordRecoveryRequest = sanitizeForFirestore({
      id: requestId,
      organizationId: params.organizationId || null,
      email: cleanEmail,
      employeeId: params.employeeId?.trim() || null,
      note: params.note?.trim() || null,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    });

    try {
      await setDoc(doc(db, 'passwordRecoveryRequests', requestId), payload);
      return payload;
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `passwordRecoveryRequests/${requestId}`);
    }
  },

  // Reauthenticate & update password for the currently signed-in user
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('An active email/password session is required to change your password.');
    }
    if (!currentPassword) {
      throw new Error('Please enter your current password.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    if (currentPassword === newPassword) {
      throw new Error('New password must be different from your current password.');
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (error: any) {
      throw mapEmailAuthError(error, 'password_change');
    }
  },

  // Sign out
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign-out failed:', error);
      throw error;
    }
  },

  // Fetch user profile from Firestore
  async getUserProfile(userId: string): Promise<User | null> {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) return null;
      return snap.data() as User;
    } catch (error) {
      console.warn('Could not fetch user profile:', error);
      return null;
    }
  },

  // Synchronize user profile in Firestore (without blindly granting active access to uninvited users)
  async syncUserProfile(fbUser: FirebaseUser, extra?: Partial<User>): Promise<User | null> {
    const userDocRef = doc(db, 'users', fbUser.uid);
    const now = new Date().toISOString();

    try {
      const snap = await getDoc(userDocRef);
      const isOwnerEmail = fbUser.email?.toLowerCase() === 'mmarcialpa@gmail.com';

      if (snap.exists()) {
        const data = snap.data() as User;
        const fallbackName = data.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
        const resolvedAvatar =
          fbUser.photoURL ||
          data.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=0f172a&color=fff`;

        const updatedUser: User = {
          ...data,
          id: data.id || fbUser.uid,
          roleIds:
            Array.isArray(data.roleIds) && data.roleIds.length > 0
              ? data.roleIds
              : isOwnerEmail
              ? ['role_super_admin']
              : ['role_member'],
          accountStatus: data.accountStatus || 'active',
          avatar: resolvedAvatar,
          updatedAt: now
        };

        if (resolvedAvatar !== data.avatar) {
          await updateDoc(
            userDocRef,
            sanitizeForFirestore({
              avatar: resolvedAvatar,
              updatedAt: now
            })
          );
        }
        return updatedUser;
      }

      if (!isOwnerEmail && !extra?.accountStatus) {
        return null;
      }

      const displayName = extra?.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
      const parts = displayName.trim().split(/\s+/);
      const firstName = extra?.firstName || parts[0] || 'User';
      const lastName = extra?.lastName || parts.slice(1).join(' ') || '';
      const defaultRoles = isOwnerEmail ? ['role_super_admin'] : ['role_member'];

      const newUser: User = sanitizeForFirestore({
        id: fbUser.uid,
        organizationId: extra?.organizationId || 'org_mars_default',
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email: (fbUser.email || '').toLowerCase(),
        employeeId: extra?.employeeId ?? null,
        avatar:
          fbUser.photoURL ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0f172a&color=fff`,
        departmentId: null,
        positionId: null,
        managerId: null,
        roleIds: defaultRoles,
        primaryRoleId: defaultRoles[0],
        accountStatus: isOwnerEmail ? 'active' : extra?.accountStatus || 'pending_approval',
        emailVerified: Boolean(fbUser.emailVerified),
        dateJoined: now.split('T')[0],
        createdAt: now,
        updatedAt: now
      });

      await setDoc(userDocRef, newUser);
      return newUser;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${fbUser.uid}`);
    }
  },

  // Listen to Auth State
  onAuthState(callback: (user: FirebaseUser | null) => void): Unsubscribe {
    return onAuthStateChanged(auth, callback);
  }
};
