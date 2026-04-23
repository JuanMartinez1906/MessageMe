import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { config } from './config';
import { messageService, MessageDto, typeToProto } from './message.service';

const log = createLogger('message-service');

const messagePkg = loadProto('message.proto');
const MessageServiceDef = (resolveService(messagePkg, 'messageme.message.MessageService') as any).service;

function toTimestamp(d: Date | null) {
  if (!d) return undefined;
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function toProto(m: MessageDto) {
  return {
    messageId: m.messageId,
    senderId: m.senderId,
    type: typeToProto(m.type),
    content: m.content,
    fileUrl: m.fileUrl ?? '',
    channelId: m.channelId ?? '',
    conversationId: m.conversationId ?? '',
    createdAt: toTimestamp(m.createdAt),
    editedAt: m.editedAt ? toTimestamp(m.editedAt) : undefined,
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
  sendMessage: guard(async (req: any) =>
    toProto(
      await messageService.sendMessage({
        senderId: req.senderId,
        type: messageService._typeFromProto(req.type),
        content: req.content ?? '',
        fileUrl: req.fileUrl || undefined,
        channelId: req.channelId || undefined,
        conversationId: req.conversationId || undefined,
        clientMessageId: req.clientMessageId || undefined,
      })
    )
  ),

  getMessage: guard(async (req: any) => toProto(await messageService.getMessage(req.messageId))),

  getHistory: guard(async (req: any) => {
    const limit = parseInt(req.page?.limit ?? '50', 10) || 50;
    const res = await messageService.getHistory({
      channelId: req.channelId || undefined,
      conversationId: req.conversationId || undefined,
      cursor: req.page?.cursor || undefined,
      limit,
    });
    return {
      messages: res.messages.map(toProto),
      pageInfo: { nextCursor: res.nextCursor, hasMore: res.hasMore },
    };
  }),

  streamHistory: async (call: grpc.ServerWritableStream<any, any>) => {
    try {
      const req = call.request;
      const limit = parseInt(req.page?.limit ?? '50', 10) || 50;
      const res = await messageService.getHistory({
        channelId: req.channelId || undefined,
        conversationId: req.conversationId || undefined,
        cursor: req.page?.cursor || undefined,
        limit,
      });
      for (const m of res.messages) call.write(toProto(m));
      call.end();
    } catch (err) {
      if (err instanceof AppError) {
        call.destroy(err.toGrpc());
      } else {
        log.error({ err }, 'streamHistory failed');
        call.destroy(new AppError('INTERNAL', 'Internal server error').toGrpc());
      }
    }
  },

  editMessage: guard(async (req: any) =>
    toProto(
      await messageService.editMessage({
        messageId: req.messageId,
        senderId: req.senderId,
        newContent: req.newContent,
      })
    )
  ),

  deleteMessage: guard(async (req: any) => {
    await messageService.deleteMessage({ messageId: req.messageId, senderId: req.senderId });
    return {};
  }),
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(MessageServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'message-service gRPC listening');
        resolve();
      }
    );
  });
}
