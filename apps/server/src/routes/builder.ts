import type { BuyersResponse, BuyerStatus, OverviewResponse } from '@gatehood/shared';
import { Router } from 'express';
import { z } from 'zod';
import { depsOf } from '../deps.js';

const BuyersQuery = z.object({
  tower: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{1,3}$/, 'Tower must be 1 to 3 letters, like A')
    .transform((t) => t.toUpperCase())
    .optional(),
});

type Counts = { units: number; invited: number; joined: number };

/** `GET /overview` and `GET /buyers`. Mount under `/api/builder`, behind `requireRole('builder')`. */
export function builderRouter(): Router {
  const router = Router();

  // Per tower: units, buyers invited, buyers joined. Counted in memory, which is fine for a few hundred units.
  router.get('/overview', async (req, res) => {
    const { db } = depsOf(req);
    const [towers, units, invites, members] = await Promise.all([
      db.collection('towers').get(),
      db.collection('units').select('towerId').get(),
      db.collection('invites').select('towerId').get(),
      db.collection('members').where('role', '==', 'buyer').select('towerId').get(),
    ]);

    const counts = new Map<string, Counts>();
    const of = (towerId: unknown): Counts | null => {
      if (typeof towerId !== 'string' || towerId === '') return null;
      let c = counts.get(towerId);
      if (!c) counts.set(towerId, (c = { units: 0, invited: 0, joined: 0 }));
      return c;
    };
    for (const t of towers.docs) of(t.id);
    for (const u of units.docs) { const c = of(u.get('towerId')); if (c) c.units++; }
    for (const i of invites.docs) { const c = of(i.get('towerId')); if (c) c.invited++; }
    for (const m of members.docs) { const c = of(m.get('towerId')); if (c) c.joined++; }

    const names = new Map(towers.docs.map((t) => [t.id, t.get('name') as unknown]));
    const body: OverviewResponse = {
      towers: [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([towerId, c]) => {
          const name = names.get(towerId);
          return { towerId, name: typeof name === 'string' ? name : `Tower ${towerId}`, ...c };
        }),
    };
    res.json(body);
  });

  // Every invite with its status, optionally for one tower, sorted by unit.
  router.get('/buyers', async (req, res) => {
    const { tower } = BuyersQuery.parse(req.query);
    const { db, now } = depsOf(req);
    const at = now().getTime();

    const query = tower ? db.collection('invites').where('towerId', '==', tower) : db.collection('invites');
    const snap = await query.get();

    const buyers: BuyersResponse['buyers'] = snap.docs.map((doc) => {
      const d = doc.data();
      const joined = typeof d.usedBy === 'string' && d.usedBy !== '';
      const status: BuyerStatus = joined
        ? 'joined'
        : typeof d.expiresAt === 'number' && d.expiresAt <= at
          ? 'expired'
          : 'pending';
      return {
        code: doc.id,
        unitId: String(d.unitId),
        towerId: String(d.towerId),
        name: String(d.name),
        phone: String(d.phone),
        status,
        ...(joined && typeof d.usedAt === 'number' ? { joinedAt: d.usedAt } : {}),
      };
    });
    buyers.sort((a, b) => a.unitId.localeCompare(b.unitId) || a.name.localeCompare(b.name));

    const body: BuyersResponse = { buyers };
    res.json(body);
  });

  return router;
}
