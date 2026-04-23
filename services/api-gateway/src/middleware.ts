import { Request, Response, NextFunction } from 'express';
import * as grpc from '@grpc/grpc-js';
import { AppError, grpcErrorToApp, Logger } from '@messageme/shared';
import { auth } from './grpc-clients';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(new AppError('UNAUTHENTICATED', 'Missing bearer token'));
    }
    const token = header.slice(7);
    try {
      const { userId, valid } = await auth.validateToken({ accessToken: token });
      if (!valid) return next(new AppError('UNAUTHENTICATED', 'Invalid token'));
      req.userId = userId;
      next();
    } catch (err) {
      next(grpcErrorToApp(err as grpc.ServiceError));
    }
  };
}

export function errorHandler(log: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      log.warn({ code: err.code, msg: err.message }, 'handled error');
      return res.status(err.httpStatus).json({ error: { code: err.code, message: err.message } });
    }
    const grpcErr = err as grpc.ServiceError;
    if (grpcErr && typeof grpcErr.code === 'number') {
      const translated = grpcErrorToApp(grpcErr);
      log.warn({ code: translated.code, msg: translated.message }, 'downstream gRPC error');
      return res
        .status(translated.httpStatus)
        .json({ error: { code: translated.code, message: translated.message } });
    }
    log.error({ err }, 'unhandled error');
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  };
}
