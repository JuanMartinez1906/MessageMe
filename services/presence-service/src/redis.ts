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
//   presence:sessions:<userId>    SET of sessionIds currently active
//   presence:session:<sessionId>  STRING userId (TTL-expiring heartbeat marker)
//   presence:lastseen:<userId>    STRING ISO timestamp (no TTL)

export const keys = {
  sessionsOf: (userId: string) => `presence:sessions:${userId}`,
  session: (sessionId: string) => `presence:session:${sessionId}`,
  lastSeen: (userId: string) => `presence:lastseen:${userId}`,
};
