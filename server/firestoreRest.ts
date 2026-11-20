import { readFileSync } from 'node:fs';
import path from 'node:path';

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8')) as FirebaseAppletConfig;

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const API_KEY = firebaseConfig.apiKey;
const FIRESTORE_DOCUMENTS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const FIRESTORE_COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:commit`;
const FIRESTORE_QUERY_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery`;

export function getFirebaseWebApiKey(): string {
  return API_KEY;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoUrl?: string;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  if (!idToken) {
    throw new Error('Missing Firebase authentication token.');
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.users) || data.users.length === 0) {
    const errMsg = data?.error?.message || 'Invalid or expired authentication session.';
    throw new Error(errMsg);
  }
  const u = data.users[0];
  return {
    uid: String(u.localId),
    email: String(u.email || '').toLowerCase(),
    emailVerified: Boolean(u.emailVerified),
    displayName: u.displayName ? String(u.displayName) : undefined,
    photoUrl: u.photoUrl ? String(u.photoUrl) : undefined
  };
}

type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

export function toFirestoreValue(val: unknown): FsValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((v) => v !== undefined).map((v) => toFirestoreValue(v))
      }
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FsValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

export function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('arrayValue' in val) {
    const arr = val.arrayValue?.values || [];
    return arr.map((item: any) => fromFirestoreValue(item));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

export function fromFirestoreDoc<T = Record<string, unknown>>(doc: any): (T & { _updateTime?: string }) | null {
  if (!doc || !doc.fields) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    out[k] = fromFirestoreValue(v);
  }
  if (doc.updateTime) {
    Object.defineProperty(out, '_updateTime', {
      value: String(doc.updateTime),
      enumerable: false,
      configurable: true,
      writable: true
    });
  }
  return out as T & { _updateTime?: string };
}

function buildHeaders(idToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  return headers;
}

export function docResourceName(docPath: string): string {
  return `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${docPath}`;
}

export async function fsGetDoc<T = Record<string, unknown>>(
  docPath: string,
  idToken?: string | null
): Promise<(T & { _updateTime?: string }) | null> {
  const res = await fetch(`${FIRESTORE_DOCUMENTS_BASE}/${docPath}`, {
    method: 'GET',
    headers: buildHeaders(idToken)
  });
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `Firestore GET ${docPath} failed (${res.status}).`);
  }
  return fromFirestoreDoc<T>(body);
}

export async function fsSetDoc(
  docPath: string,
  data: Record<string, unknown>,
  idToken: string
): Promise<void> {
  const res = await fetch(`${FIRESTORE_DOCUMENTS_BASE}/${docPath}`, {
    method: 'PATCH',
    headers: buildHeaders(idToken),
    body: JSON.stringify({ fields: toFirestoreFields(data) })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Firestore SET ${docPath} failed (${res.status}).`);
  }
}

export async function fsPatchDoc(
  docPath: string,
  updates: Record<string, unknown>,
  idToken: string
): Promise<void> {
  const keys = Object.keys(updates).filter((k) => updates[k] !== undefined);
  if (keys.length === 0) return;

  const maskParams = keys
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');

  const filtered: Record<string, unknown> = {};
  for (const k of keys) {
    filtered[k] = updates[k];
  }

  const res = await fetch(`${FIRESTORE_DOCUMENTS_BASE}/${docPath}?${maskParams}`, {
    method: 'PATCH',
    headers: buildHeaders(idToken),
    body: JSON.stringify({ fields: toFirestoreFields(filtered) })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Firestore PATCH ${docPath} failed (${res.status}).`);
  }
}

export async function fsDeleteDoc(docPath: string, idToken: string): Promise<void> {
  const res = await fetch(`${FIRESTORE_DOCUMENTS_BASE}/${docPath}`, {
    method: 'DELETE',
    headers: buildHeaders(idToken)
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Firestore DELETE ${docPath} failed (${res.status}).`);
  }
}

export async function fsQueryEq<T = Record<string, unknown>>(
  collectionPath: string,
  field: string,
  value: string,
  idToken: string
): Promise<T[]> {
  const parts = collectionPath.split('/');
  const collectionId = parts.pop()!;
  const parentPath = parts.join('/');
  const parent = parentPath
    ? `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${parentPath}`
    : `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

  const url = parentPath
    ? `${FIRESTORE_DOCUMENTS_BASE}/${parentPath}:runQuery`
    : FIRESTORE_QUERY_URL;

  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(idToken),
    body: JSON.stringify({
      parent,
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: 'EQUAL',
            value: { stringValue: value }
          }
        }
      }
    })
  });

  const body = await res.json().catch(() => []);
  if (!res.ok) {
    const msg = body?.[0]?.error?.message || body?.error?.message || `Firestore query ${collectionPath} failed.`;
    throw new Error(msg);
  }
  if (!Array.isArray(body)) return [];
  return body
    .map((entry: any) => fromFirestoreDoc<T>(entry?.document))
    .filter((d): d is T & { _updateTime?: string } => d !== null);
}

export async function fsListCollectionDesc<T = Record<string, unknown>>(
  collectionPath: string,
  orderByField: string,
  limitCount: number,
  idToken: string
): Promise<T[]> {
  const parts = collectionPath.split('/');
  const collectionId = parts.pop()!;
  const parentPath = parts.join('/');
  const parent = parentPath
    ? `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${parentPath}`
    : `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

  const url = parentPath
    ? `${FIRESTORE_DOCUMENTS_BASE}/${parentPath}:runQuery`
    : FIRESTORE_QUERY_URL;

  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(idToken),
    body: JSON.stringify({
      parent,
      structuredQuery: {
        from: [{ collectionId }],
        orderBy: [{ field: { fieldPath: orderByField }, direction: 'DESCENDING' }],
        limit: limitCount
      }
    })
  });

  const body = await res.json().catch(() => []);
  if (!res.ok) {
    const msg = body?.[0]?.error?.message || body?.error?.message || `Firestore query ${collectionPath} failed.`;
    throw new Error(msg);
  }
  if (!Array.isArray(body)) return [];
  return body
    .map((entry: any) => fromFirestoreDoc<T>(entry?.document))
    .filter((d): d is T & { _updateTime?: string } => d !== null);
}

export interface CommitWrite {
  type: 'set' | 'update' | 'delete';
  docPath: string;
  data?: Record<string, unknown>;
  updateMask?: string[];
  currentDocument?: { exists?: boolean; updateTime?: string };
}

export async function fsCommitWrites(writes: CommitWrite[], idToken: string): Promise<void> {
  const payload = {
    writes: writes.map((w) => {
      const name = docResourceName(w.docPath);
      if (w.type === 'delete') {
        return {
          delete: name,
          ...(w.currentDocument ? { currentDocument: w.currentDocument } : {})
        };
      }
      if (w.type === 'update') {
        const keys = w.updateMask || Object.keys(w.data || {}).filter((k) => w.data?.[k] !== undefined);
        const filtered: Record<string, unknown> = {};
        for (const k of keys) {
          if (w.data && w.data[k] !== undefined) {
            filtered[k] = w.data[k];
          }
        }
        return {
          update: {
            name,
            fields: toFirestoreFields(filtered)
          },
          updateMask: { fieldPaths: keys },
          ...(w.currentDocument ? { currentDocument: w.currentDocument } : {})
        };
      }
      return {
        update: {
          name,
          fields: toFirestoreFields(w.data || {})
        },
        ...(w.currentDocument ? { currentDocument: w.currentDocument } : {})
      };
    })
  };

  const res = await fetch(FIRESTORE_COMMIT_URL, {
    method: 'POST',
    headers: buildHeaders(idToken),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Firestore atomic commit failed (${res.status}).`);
  }
}
