import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { config } from './config';
import { presenceService, PresenceEntry } from './presence.service';

const log = createLogger('presence-service');

const presencePkg = loadProto('presence.proto');
const PresenceServiceDef = (resolveService(presencePkg, 'messageme.presence.PresenceService') as any).service;

function toTimestamp(d: Date | null) {
  if (!d) return undefined;
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function entryToProto(e: PresenceEntry) {
  return {
    userId: e.userId,
    online: e.online,
    lastSeen: e.lastSeen ? toTimestamp(e.lastSeen) : undefined,
  };
}

function guard<T, R>(handler: (req: T) => Promise<R>): grpc.handleUnaryCall<T, R> {
  return async (call, callback) => {
    try {
      callback(null, await handler(call.request));
    } catch (err) {
      if (err instanceof AppError) {
        log.warn({ code: err.code, msg: err.message }, 'handled error');
        callback(err.toGrpc(), null);
      } else {
        log.error({ err }, 'unhandled error');
        callback(new AppError('INTERNAL', 'Internal server error').toGrpc(), null);
      }
    }
  };
}

const impl = {
  setOnline: guard(async (req: any) => {
    await presenceService.setOnline({ userId: req.userId, sessionId: req.sessionId });
    return { ok: true };
  }),

  setOffline: guard(async (req: any) => {
    await presenceService.setOffline({ userId: req.userId, sessionId: req.sessionId });
    return { ok: true };
  }),

  heartbeat: guard(async (req: any) => {
    await presenceService.heartbeat({ userId: req.userId, sessionId: req.sessionId });
    return { ok: true };
  }),

  getPresence: guard(async (req: any) => {
    const entries = await presenceService.getPresence(req.userIds ?? []);
    return { entries: entries.map(entryToProto) };
  }),

  // The Subscribe RPC is defined in the proto but server-streaming presence in real-time
  // is handled by ws-gateway consuming the `user.presence` Kafka topic directly, so this
  // RPC is a no-op stream that closes immediately. Kept for proto contract compliance.
  subscribe: (call: grpc.ServerWritableStream<any, any>) => {
    call.end();
  },
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(PresenceServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'presence-service gRPC listening');
        resolve();
      }
    );
  });
}
