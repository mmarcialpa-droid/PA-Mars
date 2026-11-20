import type { Request } from 'express';
import { fsGetDoc, verifyFirebaseIdToken, type VerifiedFirebaseUser } from './firestoreRest.ts';

export function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

export function getGmailAccessToken(req: Request): string {
  const headerVal = req.headers['x-gmail-access-token'];
  return typeof headerVal === 'string' ? headerVal.trim() : '';
}

export function resolveAppOrigin(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL' && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function requireAdminCaller(req: Request, orgId: string): Promise<{
  idToken: string;
  fbUser: VerifiedFirebaseUser;
  userDoc: { roleIds?: string[]; organizationId?: string; name?: string } | null;
  orgDoc: { id: string; name: string };
}> {
  const idToken = getBearerToken(req);
  if (!idToken) {
    throw Object.assign(new Error('Authentication required. Please sign in again.'), { statusCode: 401 });
  }

  const fbUser = await verifyFirebaseIdToken(idToken);
  const userDoc = await fsGetDoc<{ roleIds?: string[]; organizationId?: string; name?: string }>(
    `users/${fbUser.uid}`,
    idToken
  );

  const isPrimaryOwner = fbUser.email?.toLowerCase() === 'mmarcialpa@gmail.com';
  const userRoles = Array.isArray(userDoc?.roleIds) ? userDoc.roleIds : [];
  const hasAdminRole = userRoles.some((r) => ['role_super_admin', 'role_admin', 'super_admin'].includes(r));

  let isFallbackAdmin = false;
  if (!isPrimaryOwner && !hasAdminRole) {
    const adminFallback = await fsGetDoc(`admins/${fbUser.uid}`, idToken).catch(() => null);
    isFallbackAdmin = Boolean(adminFallback);
  }

  if (!isPrimaryOwner && !hasAdminRole && !isFallbackAdmin) {
    throw Object.assign(
      new Error('Administrator permissions are required to manage email and invitation settings.'),
      { statusCode: 403 }
    );
  }

  const orgDoc = await fsGetDoc<{ id: string; name: string }>(`organizations/${orgId}`, idToken);
  if (!orgDoc) {
    throw Object.assign(new Error('Organization record not found.'), { statusCode: 404 });
  }

  return { idToken, fbUser, userDoc, orgDoc };
}
