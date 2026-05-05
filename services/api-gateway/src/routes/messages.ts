import { Router } from 'express';
import { message, group, channel, user, delivery } from '../grpc-clients';
import { requireAuth } from '../middleware';
import { AppError } from '@messageme/shared';

export const messagesRouter = Router();

function tsToIso(ts: any): string {
  if (!ts) return new Date().toISOString();
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

function typeFromProto(t: string): string {
  return (t ?? 'MESSAGE_TYPE_TEXT').replace(/^MESSAGE_TYPE_/, '');
}

function statusFromProto(s: string | undefined): 'SENT' | 'DELIVERED' | 'READ' {
  const stripped = (s ?? 'DELIVERY_STATUS_SENT').replace(/^DELIVERY_STATUS_/, '');
  return stripped === 'DELIVERED' || stripped === 'READ' ? stripped : 'SENT';
}

async function profileLookup(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, any>();
  const res = await user.getProfiles({ userIds });
  return new Map<string, any>(res.profiles.map((p: any) => [p.userId, p]));
}

// Per-message recipient statuses (used for the ✓✓ ticks). delivery-service
// doesn't have a bulk variant, so we fan out one RPC per message — fine for the
// 50-message page size, but worth batching if we ever raise it. Failures are
// swallowed: if delivery is unreachable we'd rather show messages without
// ticks than fail the whole history fetch.
async function statusesLookup(messageIds: string[]): Promise<Map<string, any[]>> {
  if (messageIds.length === 0) return new Map();
  const results = await Promise.all(
    messageIds.map((id) =>
      delivery.getStatuses({ messageId: id }).catch(() => ({ statuses: [] as any[] }))
    )
  );
  return new Map(messageIds.map((id, i) => [id, (results[i] as any).statuses ?? []]));
}

function toDto(m: any, senderProfile?: any, statuses: any[] = []) {
  return {
    id: m.messageId,
    content: m.content ?? '',
    type: typeFromProto(m.type),
    fileUrl: m.fileUrl || null,
    createdAt: tsToIso(m.createdAt),
    editedAt: m.editedAt ? tsToIso(m.editedAt) : null,
    senderId: m.senderId,
    channelId: m.channelId || null,
    conversationId: m.conversationId || null,
    statuses: statuses.map((s: any) => ({
      userId: s.userId,
      status: statusFromProto(s.status),
      updatedAt: tsToIso(s.updatedAt),
    })),
    sender: senderProfile
      ? {
          id: senderProfile.userId,
          username: senderProfile.username,
          displayName: senderProfile.displayName,
          avatarUrl: senderProfile.avatarUrl || null,
        }
      : { id: m.senderId, username: '', displayName: '', avatarUrl: null },
  };
}

messagesRouter.use(requireAuth());

// GET /api/messages/channel/:channelId?cursor=...
messagesRouter.get('/channel/:channelId', async (req, res, next) => {
  try {
    // Access check: look up channel → group → confirm caller is a member
    const ch = await channel.getChannel({ channelId: req.params.channelId });
    const members = await group.listMembers({ groupId: ch.groupId });
    if (!members.members.some((m: any) => m.userId === req.userId)) {
      throw new AppError('FORBIDDEN', 'Not a member of this channel');
    }
    const cursor = (req.query.cursor as string | undefined) ?? '';
    const res1 = await message.getHistory({
      channelId: req.params.channelId,
      page: { cursor, limit: '50' },
    });
    const senderIds = Array.from(new Set<string>(res1.messages.map((m: any) => m.senderId)));
    const messageIds = res1.messages.map((m: any) => m.messageId);
    const [profiles, statusesMap] = await Promise.all([
      profileLookup(senderIds),
      statusesLookup(messageIds),
    ]);
    res.json(
      res1.messages.map((m: any) =>
        toDto(m, profiles.get(m.senderId), statusesMap.get(m.messageId))
      )
    );
  } catch (err) {
    next(err);
  }
});
