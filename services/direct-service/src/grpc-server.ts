import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { config } from './config';
import { directService, ConversationDto } from './direct.service';

const log = createLogger('direct-service');

const directPkg = loadProto('direct.proto');
const DirectServiceDef = (resolveService(directPkg, 'messageme.direct.DirectService') as any).service;

function toTimestamp(d: Date) {
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function toProto(c: ConversationDto) {
  return {
    conversationId: c.conversationId,
    participantIds: c.participantIds,
    createdAt: toTimestamp(c.createdAt),
    lastMessageAt: toTimestamp(c.lastMessageAt),
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
  getOrCreateConversation: guard(async (req: any) =>
    toProto(await directService.getOrCreateConversation(req.userA, req.userB))
  ),

  getConversation: guard(async (req: any) =>
    toProto(await directService.getConversation(req.conversationId, req.requestedBy))
  ),

  listForUser: guard(async (req: any) => ({
    conversations: (await directService.listForUser(req.userId)).map(toProto),
  })),
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(DirectServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'direct-service gRPC listening');
        resolve();
      }
    );
  });
}
