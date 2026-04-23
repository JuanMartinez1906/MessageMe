import { Router } from 'express';
import { presence } from '../grpc-clients';
import { requireAuth } from '../middleware';

export const presenceRouter = Router();

presenceRouter.use(requireAuth());

function tsToIso(ts: any): string | null {
  if (!ts) return null;
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  if (seconds === 0 && nanos === 0) return null;
  return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

// POST /api/presence   body: { userIds: string[] }
presenceRouter.post('/', async (req, res, next) => {
  try {
    const userIds: string[] = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
    const r = await presence.getPresence({ userIds });
    res.json(
      (r.entries ?? []).map((e: any) => ({
        userId: e.userId,
        online: !!e.online,
        lastSeen: tsToIso(e.lastSeen),
      }))
    );
  } catch (err) {
    next(err);
  }
});
