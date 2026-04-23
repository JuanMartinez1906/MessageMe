import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { config } from './config';
import { channelService, ChannelDto } from './channel.service';

const log = createLogger('channel-service');

const channelPkg = loadProto('channel.proto');
const ChannelServiceDef = (resolveService(channelPkg, 'messageme.channel.ChannelService') as any).service;

function toTimestamp(d: Date) {
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function toProto(c: ChannelDto) {
  return {
    channelId: c.channelId,
    groupId: c.groupId,
    name: c.name,
    description: c.description ?? '',
    createdAt: toTimestamp(c.createdAt),
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
  createChannel: guard(async (req: any) =>
    toProto(
      await channelService.createChannel({
        groupId: req.groupId,
        name: req.name,
        description: req.description || undefined,
        createdBy: req.createdBy,
      })
    )
  ),

  getChannel: guard(async (req: any) => toProto(await channelService.getChannel(req.channelId))),

  listChannels: guard(async (req: any) => ({
    channels: (await channelService.listChannels(req.groupId)).map(toProto),
  })),

  updateChannel: guard(async (req: any) =>
    toProto(
      await channelService.updateChannel({
        channelId: req.channelId,
        name: req.name || undefined,
        description: req.description || undefined,
      })
    )
  ),

  deleteChannel: guard(async (req: any) => {
    await channelService.deleteChannel(req.channelId, req.requestedBy);
    return {};
  }),
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(ChannelServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'channel-service gRPC listening');
        resolve();
      }
    );
  });
}
