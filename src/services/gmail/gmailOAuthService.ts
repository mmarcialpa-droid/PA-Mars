import {
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../firebase/firebase';

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface GmailSenderSession {
  accessToken: string;
  senderEmail: string;
  authorizedAt: number;
  expiresAt: number;
}

// Strictly in-memory session storage only (never persisted to localStorage/sessionStorage)
let inMemoryGmailSession: GmailSenderSession | null = null;
let isGmailPopupInFlight = false;
const listeners = new Set<(session: GmailSenderSession | null) => void>();

function notifyListeners() {
  const current = getGmailSenderSession();
  listeners.forEach((cb) => cb(current));
}

export function subscribeGmailSession(
  callback: (session: GmailSenderSession | null) => void
): () => void {
  listeners.add(callback);
  callback(getGmailSenderSession());
  return () => {
    listeners.delete(callback);
  };
}

export function getGmailSenderSession(): GmailSenderSession | null {
  if (!inMemoryGmailSession) return null;
  if (Date.now() >= inMemoryGmailSession.expiresAt) {
    inMemoryGmailSession = null;
    return null;
  }
  return inMemoryGmailSession;
}

export function isGmailSessionExpiringSoon(): boolean {
  const session = getGmailSenderSession();
  if (!session) return false;
  return session.expiresAt - Date.now() <= TOKEN_REFRESH_BUFFER_MS;
}

export function getGmailAccessToken(): string | null {
  return getGmailSenderSession()?.accessToken || null;
}

export function clearGmailSession(): void {
  inMemoryGmailSession = null;
  notifyListeners();
}

export async function authorizeGmailSender(options?: {
  forceConsent?: boolean;
}): Promise<GmailSenderSession> {
  if (isGmailPopupInFlight) {
    throw new Error('A Google authorization window is already open. Please finish or close it first.');
  }
  isGmailPopupInFlight = true;

  const provider = new GoogleAuthProvider();
  provider.addScope(GMAIL_SEND_SCOPE);
  provider.setCustomParameters({
    ...(options?.forceConsent ? { prompt: 'consent' } : {}),
    ...(auth.currentUser?.email ? { login_hint: auth.currentUser.email } : {})
  });

  try {
    let result;
    const currentUser = auth.currentUser;
    if (currentUser) {
      const hasGoogleProvider = currentUser.providerData.some(
        (p) => p.providerId === 'google.com'
      );
      if (hasGoogleProvider) {
        result = await reauthenticateWithPopup(currentUser, provider);
      } else {
        try {
          result = await linkWithPopup(currentUser, provider);
        } catch (linkErr: any) {
          if (
            linkErr?.code === 'auth/credential-already-in-use' ||
            linkErr?.code === 'auth/provider-already-linked'
          ) {
            result = await signInWithPopup(auth, provider);
          } else {
            throw linkErr;
          }
        }
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error(
        'Google authorization succeeded, but no Gmail send access token was returned. Please grant Gmail send permission when prompted.'
      );
    }

    const now = Date.now();
    inMemoryGmailSession = {
      accessToken,
      senderEmail: result.user.email || auth.currentUser?.email || 'Authorized Google Account',
      authorizedAt: now,
      // Google OAuth access tokens typically last 60m; mark renewal window at 50m
      expiresAt: now + 50 * 60 * 1000
    };
    notifyListeners();
    return inMemoryGmailSession;
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      throw new Error('Google authorization popup was closed before granting Gmail permission.');
    }
    if (err?.code === 'auth/popup-blocked') {
      throw new Error('Browser blocked the Google authorization popup. Please allow popups for this site and try again.');
    }
    if (err?.code === 'auth/user-mismatch') {
      throw new Error(
        `Please select the same Google account (${auth.currentUser?.email || 'currently signed-in admin'}) to authorize Gmail delivery.`
      );
    }
    throw new Error(err?.message || 'Could not authorize Gmail sender permission.');
  } finally {
    isGmailPopupInFlight = false;
  }
}

/**
 * Returns the active in-memory Gmail access token without re-prompting on every email send.
 * Automatically prompts a one-time refresh only if expired/expiring and interactive renewal is allowed.
 */
export async function ensureGmailAccessToken(interactiveIfMissing = false): Promise<string | null> {
  const existing = getGmailSenderSession();
  if (existing && !isGmailSessionExpiringSoon()) {
    return existing.accessToken;
  }
  if (existing && isGmailSessionExpiringSoon() && interactiveIfMissing) {
    const refreshed = await authorizeGmailSender({ forceConsent: false });
    return refreshed.accessToken;
  }
  if (!existing && interactiveIfMissing) {
    const created = await authorizeGmailSender({ forceConsent: true });
    return created.accessToken;
  }
  return existing?.accessToken || null;
}
