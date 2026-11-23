import type { Role } from '@gatehood/shared';
import type { RequestHandler } from 'express';
import { depsOf } from '../deps.js';
import { HttpError } from '../errors.js';

export interface AuthUser {
  uid: string;
  role: Role;
  towerId?: string;
  unitId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function isRole(value: unknown): value is Role {
  return value === 'builder' || value === 'buyer';
}

/**
 * Verifies `Authorization: Bearer <Firebase ID token>` and checks the `role` claim.
 * No token or a bad one gives 401; a missing or different role gives 403.
 */
export function requireRole(role: Role): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
    if (!match?.[1]) throw new HttpError(401, 'unauthorized', 'Sign in to continue.');

    let decoded;
    try {
      decoded = await depsOf(req).auth.verifyIdToken(match[1]);
    } catch {
      throw new HttpError(401, 'unauthorized', 'Your session has expired. Sign in again.');
    }

    if (!isRole(decoded.role) || decoded.role !== role) {
      throw new HttpError(403, 'forbidden', 'Your account does not have access to this.');
    }

    req.user = {
      uid: decoded.uid,
      role: decoded.role,
      ...(typeof decoded.towerId === 'string' ? { towerId: decoded.towerId } : {}),
      ...(typeof decoded.unitId === 'string' ? { unitId: decoded.unitId } : {}),
    };
    next();
  };
}
