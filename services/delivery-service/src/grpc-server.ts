import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { config } from './config';
import { deliveryService, UserStatus } from './delivery.service';
import { DeliveryStatus } from './mongo';

const log = createLogger('delivery-service');

const deliveryPkg = loadProto('delivery.proto');
const DeliveryServiceDef = (resolveService(deliveryPkg, 'messageme.delivery.DeliveryService') as any).service;

function toTimestamp(d: Date | null) {
  if (!d) return undefined;
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function statusToProto(s: DeliveryStatus): string {
  return `DELIVERY_STATUS_${s}`;
}

function statusEntryToProto(s: UserStatus) {
  return {
    userId: s.userId,
    status: statusToProto(s.status),
    updatedAt: toTimestamp(s.updatedAt),
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
  markDelivered: guard(async (req: any) => {
    const at = await deliveryService.markDelivered({
      messageId: req.messageId,
      userId: req.userId,
    });
    return { ok: true, at: toTimestamp(at) };
  }),

  markRead: guard(async (req: any) => {
    const at = await deliveryService.markRead({
      messageId: req.messageId,
      userId: req.userId,
    });
    return { ok: true, at: toTimestamp(at) };
  }),

  getStatuses: guard(async (req: any) => {
    const statuses = await deliveryService.getStatuses(req.messageId);
    return {
      messageId: req.messageId,
      statuses: statuses.map(statusEntryToProto),
    };
  }),

  getUnreadCounts: guard(async (req: any) => {
    const res = await deliveryService.getUnreadCounts(req.userId);
    return {
      channels: res.channels.map((c) => ({ scopeId: c.scopeId, count: c.count })),
      conversations: res.conversations.map((c) => ({ scopeId: c.scopeId, count: c.count })),
    };
  }),
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(DeliveryServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'delivery-service gRPC listening');
        resolve();
      }
    );
  });
}
