import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { config } from './config';
import { userService, ProfileDto } from './user.service';

const log = createLogger('user-service');

const userPkg = loadProto('user.proto');
const UserServiceDef = (resolveService(userPkg, 'messageme.user.UserService') as any).service;

function toTimestamp(d: Date) {
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function toProto(p: ProfileDto) {
  return {
    userId: p.userId,
    email: p.email,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl ?? '',
    createdAt: toTimestamp(p.createdAt),
  };
}

function guard<T, R>(
  handler: (req: T) => Promise<R>
): grpc.handleUnaryCall<T, R> {
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
  createProfile: guard(async (req: any) =>
    toProto(
      await userService.createProfile({
        userId: req.userId,
        email: req.email,
        username: req.username,
        displayName: req.displayName,
      })
    )
  ),

  getProfile: guard(async (req: any) => toProto(await userService.getProfile(req.userId))),

  getProfiles: guard(async (req: any) => ({
    profiles: (await userService.getProfiles(req.userIds ?? [])).map(toProto),
  })),

  search: guard(async (req: any) => {
    const limit = parseInt(req.page?.limit ?? '20', 10) || 20;
    const results = await userService.search(req.query ?? '', limit);
    return { results: results.map(toProto), pageInfo: { nextCursor: '', hasMore: false } };
  }),

  updateProfile: guard(async (req: any) =>
    toProto(
      await userService.updateProfile({
        userId: req.userId,
        displayName: req.displayName || undefined,
        avatarUrl: req.avatarUrl || undefined,
      })
    )
  ),
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(UserServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'user-service gRPC listening');
        resolve();
      }
    );
  });
}
