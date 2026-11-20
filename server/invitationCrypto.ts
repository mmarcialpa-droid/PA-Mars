import crypto from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 unambiguous chars (no 0/O/1/I)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return false;
  if (!EMAIL_REGEX.test(normalized)) return false;
  const [, domain] = normalized.split('@');
  if (!domain || domain.includes('..') || domain.startsWith('-') || domain.endsWith('-')) {
    return false;
  }
  const tld = domain.split('.').pop() || '';
  return tld.length >= 2;
}

/**
 * Generates a high-entropy cryptographic invitation code formatted as MARS-XXXX-XXXX-XXXX.
 * Uses rejection-free uniform sampling over a 32-character alphabet (60 bits of entropy).
 */
export function generateInvitationCode(): string {
  const bytes = crypto.randomBytes(12);
  let raw = '';
  for (let i = 0; i < 12; i += 1) {
    raw += CODE_ALPHABET[bytes[i] & 31];
  }
  return `MARS-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Normalizes user-entered invitation codes so whitespace or lowercase/dash variations match reliably,
 * while preserving backward compatibility for any legacy mars_inv_* tokens.
 */
export function normalizeInvitationCode(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';

  const compact = trimmed.replace(/[\s-]+/g, '').toUpperCase();
  if (/^MARS[A-Z2-9]{12}$/.test(compact)) {
    const body = compact.slice(4);
    return `MARS-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
  }
  if (/^[A-Z2-9]{12}$/.test(compact)) {
    return `MARS-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`;
  }

  return trimmed;
}

/**
 * Computes SHA-256 hash of a normalized invitation code.
 * Used as the document ID in /invitationLookup/{tokenHash} — safe, non-reversible, valid Firestore ID.
 */
export function hashInvitationCode(code: string): string {
  const normalized = normalizeInvitationCode(code);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Produces a non-sensitive masked representation (e.g. MARS-••••-••••-9F2A) for admin display.
 */
export function maskInvitationCode(code: string): string {
  const normalized = normalizeInvitationCode(code);
  if (normalized.startsWith('MARS-') && normalized.length >= 19) {
    return `MARS-••••-••••-${normalized.slice(-4)}`;
  }
  if (normalized.length > 6) {
    return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
  }
  return '••••••••';
}

export function generateId(prefix: string): string {
  const rand = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${Date.now()}_${rand}`;
}
