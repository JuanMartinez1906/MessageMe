import { Router } from 'express';
import { delivery } from '../grpc-clients';
import { requireAuth } from '../middleware';

export const deliveryRouter = Router();

deliveryRouter.use(requireAuth());

function tsToIso(ts: any): string | null {
  if (!ts) return null;
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  if (seconds === 0 && nanos === 0) return null;
  return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

function statusFromProto(s: string): string {
  return (s ?? 'DELIVERY_STATUS_UNSPECIFIED').replace(/^DELIVERY_STATUS_/, '');
}

// POST /api/delivery/messages/:messageId/delivered
deliveryRouter.post('/messages/:messageId/delivered', async (req, res, next) => {
  try {
    const r = await delivery.markDelivered({
      messageId: req.params.messageId,
      userId: req.userId,
    });
    res.json({ ok: !!r.ok, at: tsToIso(r.at) });
  } catch (err) {
    next(err);
  }
});

// POST /api/delivery/messages/:messageId/read
deliveryRouter.post('/messages/:messageId/read', async (req, res, next) => {
  try {
    const r = await delivery.markRead({
      messageId: req.params.messageId,
      userId: req.userId,
    });
    res.json({ ok: !!r.ok, at: tsToIso(r.at) });
  } catch (err) {
    next(err);
  }
});

// GET /api/delivery/messages/:messageId/statuses
deliveryRouter.get('/messages/:messageId/statuses', async (req, res, next) => {
  try {
    const r = await delivery.getStatuses({ messageId: req.params.messageId });
    res.json({
      messageId: r.messageId,
      statuses: (r.statuses ?? []).map((s: any) => ({
        userId: s.userId,
        status: statusFromProto(s.status),
        updatedAt: tsToIso(s.updatedAt),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/delivery/unread
deliveryRouter.get('/unread', async (req, res, next) => {
  try {
    const r = await delivery.getUnreadCounts({ userId: req.userId });
    res.json({
      channels: (r.channels ?? []).map((c: any) => ({ scopeId: c.scopeId, count: c.count })),
      conversations: (r.conversations ?? []).map((c: any) => ({
        scopeId: c.scopeId,
        count: c.count,
      })),
    });
  } catch (err) {
    next(err);
  }
});
