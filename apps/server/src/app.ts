import cors from 'cors';
import express, { type Express } from 'express';
import type { AppDeps } from './deps.js';
import { errorHandler, notFoundHandler } from './errors.js';
import type { Admin } from './firebase.js';
import { requireRole } from './middleware/auth.js';
import { builderRouter } from './routes/builder.js';
import { importRouter } from './routes/import.js';
import { invitesRouter } from './routes/invites.js';

export interface AppOptions {
  /** Adds routes before the 404 and error handlers. Used by tests. */
  extend?: (app: Express) => void;
  /** Limit invite redeems to 10 a minute per IP. Defaults to on, except under NODE_ENV=test. */
  rateLimit?: boolean;
}

export function createApp(deps: Admin & { now?: () => Date }, options: AppOptions = {}): Express {
  const app = express();
  const full: AppDeps = { db: deps.db, auth: deps.auth, now: deps.now ?? (() => new Date()) };
  app.locals.deps = full;

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/invites', invitesRouter({ rateLimit: options.rateLimit ?? process.env.NODE_ENV !== 'test' }));

  // Everything under /api/builder needs a builder login.
  app.use('/api/builder', requireRole('builder'), importRouter(), builderRouter());

  options.extend?.(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
