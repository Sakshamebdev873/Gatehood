import type { ApiErrorBody, ApiErrorCode } from '@gatehood/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** Throw this from any handler to send `{ error: { code, message } }` with the given status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function send(res: Parameters<RequestHandler>[1], status: number, code: ApiErrorCode, message: string): void {
  const body: ApiErrorBody = { error: { code, message } };
  res.status(status).json(body);
}

/** Catches unmatched routes. Mount after every router. */
export const notFoundHandler: RequestHandler = (req, res) => {
  send(res, 404, 'not_found', `No route for ${req.method} ${req.path}.`);
};

/** Turns anything thrown into the one error format. Mount last. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) return send(res, err.status, err.code, err.message);

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    return send(res, 400, 'bad_request', `${where}${issue?.message ?? 'Invalid request.'}`);
  }

  // body-parser errors carry a `type` and a 4xx status.
  const parse = err as { type?: string; status?: number };
  if (parse.type === 'entity.parse.failed') return send(res, 400, 'bad_request', 'The request body is not valid JSON.');
  if (parse.type === 'entity.too.large') return send(res, 413, 'bad_request', 'The request body is too large (2 MB max).');

  console.error(err);
  return send(res, 500, 'internal', 'Something went wrong on the server. Try again in a moment.');
};
