import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { config } from './config';
import { authService } from './auth.service';

const log = createLogger('auth-service');

const authPkg = loadProto('auth.proto');
const AuthServiceDef = (resolveService(authPkg, 'messageme.auth.AuthService') as any).service;

function toTimestamp(d: Date) {
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function guard<T, R>(
  handler: (req: T) => Promise<R>
): grpc.handleUnaryCall<T, R> {
  return async (call, callback) => {
    try {
      const res = await handler(call.request);
      callback(null, res);
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
  register: guard(async (req: any) => {
    const r = await authService.register({
      email: req.email,
      username: req.username,
      password: req.password,
      displayName: req.displayName,
    });
    return {
      userId: r.userId,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      accessExpiresAt: toTimestamp(r.accessExpiresAt),
    };
  }),

  login: guard(async (req: any) => {
    const r = await authService.login(req.email, req.password);
    return {
      userId: r.userId,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      accessExpiresAt: toTimestamp(r.accessExpiresAt),
    };
  }),

  refresh: guard(async (req: any) => {
    const r = await authService.refresh(req.refreshToken);
    return {
      userId: r.userId,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      accessExpiresAt: toTimestamp(r.accessExpiresAt),
    };
  }),

  logout: guard(async (req: any) => {
    await authService.logout(req.refreshToken);
    return { success: true };
  }),

  validateToken: guard(async (req: any) => {
    const r = await authService.validateToken(req.accessToken);
    return { valid: true, userId: r.userId, expiresAt: toTimestamp(r.expiresAt) };
  }),
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(AuthServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'auth-service gRPC listening');
        resolve();
      }
    );
  });
}
