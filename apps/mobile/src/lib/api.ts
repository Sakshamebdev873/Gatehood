import type { ApiErrorBody, ApiErrorCode } from '@gatehood/shared';

import { auth } from './firebase';

/** A failed API call, with a message that is safe to show the user. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again.";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** Attach the signed-in user's ID token. Default true. */
  auth?: boolean;
};

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const e = (value as { error: unknown }).error;
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { code?: unknown }).code === 'string' &&
    typeof (e as { message?: unknown }).message === 'string'
  );
}

function fallbackCode(status: number): ApiErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'internal';
  return 'bad_request';
}

/** Calls the Gatehood API. Throws ApiError on any non-2xx or network failure. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth: withAuth = true } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (withAuth) {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'bad_request', NETWORK_MESSAGE);
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    if (isErrorBody(data)) throw new ApiError(res.status, data.error.code, data.error.message);
    throw new ApiError(res.status, fallbackCode(res.status), 'Something went wrong. Try again in a moment.');
  }
  return data as T;
}
