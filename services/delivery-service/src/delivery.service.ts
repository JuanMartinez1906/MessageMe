import { AppError } from '@messageme/shared';
import { deliveries, DeliveryDoc, DeliveryStatus } from './mongo';
import { getRedis, keys } from './redis';
import { publishDelivered, publishRead, MessageSentEvent } from './kafka';

export interface UserStatus {
  userId: string;
  status: DeliveryStatus;
  updatedAt: Date;
}

export interface UnreadCount {
  scopeId: string;
  count: number;
}

async function incrementUnread(args: {
  userId: string;
  channelId: string | null;
  conversationId: string | null;
}): Promise<void> {
  const r = getRedis();
  if (args.channelId) {
    await Promise.all([
      r.incr(keys.unreadChannel(args.userId, args.channelId)),
      r.sadd(keys.unreadChannelsSet(args.userId), args.channelId),
    ]);
  } else if (args.conversationId) {
    await Promise.all([
      r.incr(keys.unreadConv(args.userId, args.conversationId)),
      r.sadd(keys.unreadConvsSet(args.userId), args.conversationId),
    ]);
  }
}

// ws-gateway can call markDelivered before delivery-service has consumed the
// `messages.sent` event that creates the SENT row — retry briefly to absorb this race.
async function waitForDeliveryRow(
  id: string,
  attempts = 10,
  intervalMs = 50
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const exists = await deliveries().findOne({ _id: id });
    if (exists) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function clearUnreadForScope(args: {
  userId: string;
  channelId: string | null;
  conversationId: string | null;
}): Promise<void> {
  const r = getRedis();
  if (args.channelId) {
    await Promise.all([
      r.del(keys.unreadChannel(args.userId, args.channelId)),
      r.srem(keys.unreadChannelsSet(args.userId), args.channelId),
    ]);
  } else if (args.conversationId) {
    await Promise.all([
      r.del(keys.unreadConv(args.userId, args.conversationId)),
      r.srem(keys.unreadConvsSet(args.userId), args.conversationId),
    ]);
  }
}

export const deliveryService = {
  // Called by the Kafka consumer for every `messages.sent` event. Creates a SENT row
  // per recipient so GetStatuses can report "delivered-to-how-many-out-of-N".
  async onMessageSent(event: MessageSentEvent): Promise<void> {
    const p = event.payload;
    const recipients = p.recipient_ids ?? [];
    if (recipients.length === 0) return;
    const sentAt = new Date(p.created_at);
    const now = new Date();
    const docs: DeliveryDoc[] = recipients.map((userId) => ({
      _id: `${p.message_id}:${userId}`,
      messageId: p.message_id,
      userId,
      senderId: p.sender_id,
      channelId: p.channel_id,
      conversationId: p.conversation_id,
      status: 'SENT',
      sentAt,
      deliveredAt: null,
      readAt: null,
      updatedAt: now,
    }));
    // Idempotent: `insertMany` with `ordered: false` tolerates duplicate-key errors
    // caused by redelivered Kafka events.
    try {
      await deliveries().insertMany(docs, { ordered: false });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
    // Increment unread counters for each recipient.
    await Promise.all(
      recipients.map((userId) =>
        incrementUnread({
          userId,
          channelId: p.channel_id,
          conversationId: p.conversation_id,
        })
      )
    );
  },

  async markDelivered(args: { messageId: string; userId: string }): Promise<Date> {
    if (!args.messageId || !args.userId) {
      throw new AppError('BAD_REQUEST', 'messageId and userId are required');
    }
    const id = `${args.messageId}:${args.userId}`;
    await waitForDeliveryRow(id);
    const deliveredAt = new Date();
    // Only advance from SENT → DELIVERED. If already READ we don't regress.
    const res = await deliveries().findOneAndUpdate(
      { _id: id, status: 'SENT' },
      { $set: { status: 'DELIVERED', deliveredAt, updatedAt: deliveredAt } },
      { returnDocument: 'after' }
    );
    if (!res) {
      // Either already delivered/read or no such row — look up current state.
      const cur = await deliveries().findOne({ _id: id });
      if (!cur) throw new AppError('NOT_FOUND', 'Delivery record not found');
      return cur.deliveredAt ?? cur.updatedAt;
    }
    await publishDelivered({
      messageId: res.messageId,
      userId: res.userId,
      senderId: res.senderId,
      channelId: res.channelId,
      conversationId: res.conversationId,
      deliveredAt,
    });
    return deliveredAt;
  },

  async markRead(args: { messageId: string; userId: string }): Promise<Date> {
    if (!args.messageId || !args.userId) {
      throw new AppError('BAD_REQUEST', 'messageId and userId are required');
    }
    const id = `${args.messageId}:${args.userId}`;
    await waitForDeliveryRow(id);
    const readAt = new Date();
    const res = await deliveries().findOneAndUpdate(
      { _id: id, status: { $in: ['SENT', 'DELIVERED'] } },
      {
        $set: {
          status: 'READ',
          readAt,
          updatedAt: readAt,
          // If it went straight from SENT → READ (user opened the chat while disconnected),
          // persist a deliveredAt too.
          deliveredAt: readAt,
        },
      },
      { returnDocument: 'after' }
    );
    if (!res) {
      const cur = await deliveries().findOne({ _id: id });
      if (!cur) throw new AppError('NOT_FOUND', 'Delivery record not found');
      return cur.readAt ?? cur.updatedAt;
    }
    await publishRead({
      messageId: res.messageId,
      userId: res.userId,
      senderId: res.senderId,
      channelId: res.channelId,
      conversationId: res.conversationId,
      readAt,
    });
    // Decrement unread: reading a single message drops the counter by 1, not to 0,
    // because other messages in the scope may still be unread.
    const r = getRedis();
    if (res.channelId) {
      const remaining = await r.decr(keys.unreadChannel(res.userId, res.channelId));
      if (remaining <= 0) await clearUnreadForScope({
        userId: res.userId,
        channelId: res.channelId,
        conversationId: null,
      });
    } else if (res.conversationId) {
      const remaining = await r.decr(keys.unreadConv(res.userId, res.conversationId));
      if (remaining <= 0) await clearUnreadForScope({
        userId: res.userId,
        channelId: null,
        conversationId: res.conversationId,
      });
    }
    return readAt;
  },

  async getStatuses(messageId: string): Promise<UserStatus[]> {
    const docs = await deliveries().find({ messageId }).toArray();
    return docs.map((d) => ({ userId: d.userId, status: d.status, updatedAt: d.updatedAt }));
  },

  async getUnreadCounts(
    userId: string
  ): Promise<{ channels: UnreadCount[]; conversations: UnreadCount[] }> {
    const r = getRedis();
    const [channelIds, convIds] = await Promise.all([
      r.smembers(keys.unreadChannelsSet(userId)),
      r.smembers(keys.unreadConvsSet(userId)),
    ]);
    const channels: UnreadCount[] = [];
    if (channelIds.length > 0) {
      const vals = await r.mget(...channelIds.map((c) => keys.unreadChannel(userId, c)));
      for (let i = 0; i < channelIds.length; i++) {
        const n = parseInt(vals[i] ?? '0', 10) || 0;
        if (n > 0) channels.push({ scopeId: channelIds[i], count: n });
      }
    }
    const conversations: UnreadCount[] = [];
    if (convIds.length > 0) {
      const vals = await r.mget(...convIds.map((c) => keys.unreadConv(userId, c)));
      for (let i = 0; i < convIds.length; i++) {
        const n = parseInt(vals[i] ?? '0', 10) || 0;
        if (n > 0) conversations.push({ scopeId: convIds[i], count: n });
      }
    }
    return { channels, conversations };
  },
};
