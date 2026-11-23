import type { Request } from 'express';
import type { Admin } from './firebase.js';

export interface AppDeps extends Admin {
  /** The clock. Tests pass a fixed one to check expiry. */
  now: () => Date;
}

/** The deps `createApp` was built with, for middleware and routers. */
export function depsOf(req: Request): AppDeps {
  return req.app.locals.deps as AppDeps;
}
