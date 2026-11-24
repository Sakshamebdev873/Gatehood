import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { beforeAll, describe, expect, it } from 'vitest';
import { HttpError } from '../src/errors.js';
import { requireRole } from '../src/middleware/auth.js';
import { clearAuth, idTokenFor, makeApp } from './helpers.js';

let app: Express;
let builderToken: string;
let buyerToken: string;

beforeAll(async () => {
  await clearAuth();
  app = makeApp(undefined, {
    extend(a) {
      a.get('/api/builder/ping', requireRole('builder'), (req, res) => {
        res.json({ uid: req.user?.uid, role: req.user?.role });
      });
      a.get('/api/buyer/ping', requireRole('buyer'), (req, res) => {
        res.json({ towerId: req.user?.towerId, unitId: req.user?.unitId });
      });
      a.get('/boom/http', () => {
        throw new HttpError(409, 'code_used', 'Already used.');
      });
      a.post('/boom/zod', (req, res) => {
        z.object({ n: z.number() }).parse(req.body);
        res.json({ ok: true });
      });
      a.get('/boom/crash', async () => {
        throw new Error('secret internal detail');
      });
    },
  });
  builderToken = await idTokenFor('builder-1', { role: 'builder' });
  buyerToken = await idTokenFor('buyer-1', { role: 'buyer', towerId: 'A', unitId: 'A-1204' });
});

describe('GET /health', () => {
  it('returns 200 { ok: true }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('requireRole', () => {
  it('gives 401 with no token', async () => {
    const res = await request(app).get('/api/builder/ping');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('gives 401 with a bad token', async () => {
    const res = await request(app).get('/api/builder/ping').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('gives 401 when the header is not a bearer token', async () => {
    const res = await request(app).get('/api/builder/ping').set('Authorization', `Basic ${builderToken}`);
    expect(res.status).toBe(401);
  });

  it('gives 403 to a buyer on a builder route', async () => {
    const res = await request(app).get('/api/builder/ping').set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('gives 403 to a signed-in user with no role', async () => {
    const token = await idTokenFor('nobody-1', {});
    const res = await request(app).get('/api/builder/ping').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('gives 200 to a builder and sets req.user', async () => {
    const res = await request(app).get('/api/builder/ping').set('Authorization', `Bearer ${builderToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uid: 'builder-1', role: 'builder' });
  });

  it('passes a buyer their tower and unit from the token claims', async () => {
    const res = await request(app).get('/api/buyer/ping').set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ towerId: 'A', unitId: 'A-1204' });
  });
});

describe('error format', () => {
  it('renders HttpError as { error: { code, message } }', async () => {
    const res = await request(app).get('/boom/http');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'code_used', message: 'Already used.' } });
  });

  it('maps zod errors to 400 bad_request', async () => {
    const res = await request(app).post('/boom/zod').send({ n: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('maps malformed JSON to 400 bad_request', async () => {
    const res = await request(app).post('/boom/zod').set('content-type', 'application/json').send('{"n":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('gives 404 not_found for an unknown route', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('hides internal error details behind a 500', async () => {
    const res = await request(app).get('/boom/crash');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal');
    expect(res.body.error.message).not.toContain('secret');
  });
});
