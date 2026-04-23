import Redis from 'ioredis';
import { config } from './config';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 });
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => void 0);
    client = null;
  }
}

// Keys:
//   delivery:unread:channel:<userId>:<channelId>           STRING int counter
//   delivery:unread:conv:<userId>:<conversationId>         STRING int counter
//   delivery:unread:channels:<userId>                      SET of channelIds with unread > 0
//   delivery:unread:convs:<userId>                         SET of conversationIds with unread > 0
// Counters are the authoritative fast path; Mongo is the durable ledger.

export const keys = {
  unreadChannel: (userId: string, channelId: string) =>
    `delivery:unread:channel:${userId}:${channelId}`,
  unreadConv: (userId: string, conversationId: string) =>
    `delivery:unread:conv:${userId}:${conversationId}`,
  unreadChannelsSet: (userId: string) => `delivery:unread:channels:${userId}`,
  unreadConvsSet: (userId: string) => `delivery:unread:convs:${userId}`,
};
