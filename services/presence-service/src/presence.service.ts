import { AppError } from '@messageme/shared';
import { getRedis, keys } from './redis';
import { publishPresence } from './kafka';
import { config } from './config';

export interface PresenceEntry {
  userId: string;
  online: boolean;
  lastSeen: Date | null;
}

export const presenceService = {
  // Called by ws-gateway on socket connect. A user can have many sessions (tabs/devices);
  // we only publish the presence event on the transition offline → online.
  async setOnline(args: { userId: string; sessionId: string }): Promise<void> {
    if (!args.userId || !args.sessionId) {
      throw new AppError('BAD_REQUEST', 'userId and sessionId are required');
    }
    const r = getRedis();
    const wasOnline = (await r.scard(keys.sessionsOf(args.userId))) > 0;
    await Promise.all([
      r.sadd(keys.sessionsOf(args.userId), args.sessionId),
      r.set(keys.session(args.sessionId), args.userId, 'EX', config.presenceTtlSeconds),
    ]);
    if (!wasOnline) {
      await publishPresence({ userId: args.userId, online: true, lastSeen: null });
    }
  },

  // Called by ws-gateway on socket disconnect. Only emits an event on the last active session.
  async setOffline(args: { userId: string; sessionId: string }): Promise<void> {
    if (!args.userId || !args.sessionId) {
      throw new AppError('BAD_REQUEST', 'userId and sessionId are required');
    }
    const r = getRedis();
    await Promise.all([
      r.srem(keys.sessionsOf(args.userId), args.sessionId),
      r.del(keys.session(args.sessionId)),
    ]);
    const remaining = await r.scard(keys.sessionsOf(args.userId));
    if (remaining === 0) {
      const at = new Date().toISOString();
      await r.set(keys.lastSeen(args.userId), at);
      await publishPresence({ userId: args.userId, online: false, lastSeen: at });
    }
  },

  // Refreshes the TTL so sessions that haven't explicitly disconnected still count as online.
  async heartbeat(args: { userId: string; sessionId: string }): Promise<void> {
    if (!args.userId || !args.sessionId) {
      throw new AppError('BAD_REQUEST', 'userId and sessionId are required');
    }
    const r = getRedis();
    // Re-add to the set (cheap if already there) and refresh the session key TTL.
    await Promise.all([
      r.sadd(keys.sessionsOf(args.userId), args.sessionId),
      r.set(keys.session(args.sessionId), args.userId, 'EX', config.presenceTtlSeconds),
    ]);
  },

  async getPresence(userIds: string[]): Promise<PresenceEntry[]> {
    if (userIds.length === 0) return [];
    const r = getRedis();
    const pipeline = r.pipeline();
    for (const uid of userIds) {
      pipeline.scard(keys.sessionsOf(uid));
      pipeline.get(keys.lastSeen(uid));
    }
    const results = await pipeline.exec();
    if (!results) return userIds.map((userId) => ({ userId, online: false, lastSeen: null }));

    const out: PresenceEntry[] = [];
    for (let i = 0; i < userIds.length; i++) {
      const [errCard, card] = results[i * 2] ?? [null, 0];
      const [errLast, lastRaw] = results[i * 2 + 1] ?? [null, null];
      if (errCard || errLast) {
        out.push({ userId: userIds[i], online: false, lastSeen: null });
        continue;
      }
      const online = Number(card ?? 0) > 0;
      const lastSeen = typeof lastRaw === 'string' ? new Date(lastRaw) : null;
      out.push({ userId: userIds[i], online, lastSeen });
    }
    return out;
  },
};
