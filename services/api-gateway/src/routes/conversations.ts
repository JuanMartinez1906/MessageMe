import { Router } from 'express';
import { direct, message, user, delivery } from '../grpc-clients';
import { requireAuth } from '../middleware';
import { AppError } from '@messageme/shared';

export const conversationsRouter = Router();

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

// DM history needs the recipient's status so the sender's ✓✓ persists across
// refreshes. We fetch one delivery row per message (no bulk RPC yet); errors
// degrade to "no status" rather than failing the whole fetch.
async function statusesLookup(messageIds: string[]): Promise<Map<string, any[]>> {
  if (messageIds.length === 0) return new Map();
  const results = await Promise.all(
    messageIds.map((id) =>
      delivery.getStatuses({ messageId: id }).catch(() => ({ statuses: [] as any[] }))
    )
  );
  return new Map(messageIds.map((id, i) => [id, (results[i] as any).statuses ?? []]));
}

function toMessageDto(
  m: any,
  myUserId: string,
  senderProfile?: any,
  statuses: any[] = []
) {
  // For a 1-on-1 DM, the only status that matters to the sender is the OTHER
  // party's. If we're the sender, surface the recipient's status; otherwise
  // default to READ (we wouldn't be loading a message we hadn't seen).
  const isOwn = m.senderId === myUserId;
  let status: 'SENT' | 'DELIVERED' | 'READ' = 'SENT';
  if (isOwn) {
    const other = statuses.find((s: any) => s.userId !== myUserId);
    if (other) status = statusFromProto(other.status);
  } else {
    status = 'READ';
  }
  return {
    id: m.messageId,
    content: m.content ?? '',
    type: typeFromProto(m.type),
    fileUrl: m.fileUrl || null,
    createdAt: tsToIso(m.createdAt),
    editedAt: m.editedAt ? tsToIso(m.editedAt) : null,
    status,
    senderId: m.senderId,
    conversationId: m.conversationId || null,
    channelId: m.channelId || null,
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

conversationsRouter.use(requireAuth());

conversationsRouter.post('/conversations', async (req, res, next) => {
  try {
    const { participantId } = req.body;
    if (!participantId) throw new AppError('BAD_REQUEST', 'participantId required');
    if (participantId === req.userId) throw new AppError('BAD_REQUEST', 'Cannot DM yourself');

    const conv = await direct.getOrCreateConversation({ userA: req.userId, userB: participantId });
    const profiles = await profileLookup(conv.participantIds);
    res.json({
      id: conv.conversationId,
      createdAt: tsToIso(conv.createdAt),
      lastMessageAt: tsToIso(conv.lastMessageAt),
      participants: conv.participantIds.map((uid: string) => {
        const p = profiles.get(uid);
        return {
          id: uid,
          userId: uid,
          user: p
            ? {
                id: p.userId,
                username: p.username,
                displayName: p.displayName,
                avatarUrl: p.avatarUrl || null,
                isOnline: false,
              }
            : { id: uid, username: '', displayName: '', avatarUrl: null, isOnline: false },
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

conversationsRouter.get('/conversations', async (req, res, next) => {
  try {
    const list = await direct.listForUser({ userId: req.userId });
    const allIds = new Set<string>();
    list.conversations.forEach((c: any) => c.participantIds.forEach((id: string) => allIds.add(id)));
    const profiles = await profileLookup(Array.from(allIds));
    res.json(
      list.conversations.map((c: any) => ({
        id: c.conversationId,
        createdAt: tsToIso(c.createdAt),
        lastMessageAt: tsToIso(c.lastMessageAt),
        participants: c.participantIds.map((uid: string) => {
          const p = profiles.get(uid);
          return {
            id: uid,
            userId: uid,
            user: p
              ? {
                  id: p.userId,
                  username: p.username,
                  displayName: p.displayName,
                  avatarUrl: p.avatarUrl || null,
                  isOnline: false,
                }
              : { id: uid, username: '', displayName: '', avatarUrl: null, isOnline: false },
          };
        }),
      }))
    );
  } catch (err) {
    next(err);
  }
});

conversationsRouter.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    // Access check
    await direct.getConversation({ conversationId: req.params.id, requestedBy: req.userId });
    const cursor = (req.query.cursor as string | undefined) ?? '';
    const res1 = await message.getHistory({
      conversationId: req.params.id,
      page: { cursor, limit: '50' },
    });
    const senderIds = Array.from(new Set<string>(res1.messages.map((m: any) => m.senderId)));
    const messageIds = res1.messages.map((m: any) => m.messageId);
    const [profiles, statusesMap] = await Promise.all([
      profileLookup(senderIds),
      statusesLookup(messageIds),
    ]);
    const myUserId = req.userId!;
    res.json(
      res1.messages.map((m: any) =>
        toMessageDto(m, myUserId, profiles.get(m.senderId), statusesMap.get(m.messageId))
      )
    );
  } catch (err) {
    next(err);
  }
});
