import * as grpc from '@grpc/grpc-js';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

const codeToGrpc: Record<ErrorCode, grpc.status> = {
  BAD_REQUEST: grpc.status.INVALID_ARGUMENT,
  UNAUTHENTICATED: grpc.status.UNAUTHENTICATED,
  FORBIDDEN: grpc.status.PERMISSION_DENIED,
  NOT_FOUND: grpc.status.NOT_FOUND,
  CONFLICT: grpc.status.ALREADY_EXISTS,
  INTERNAL: grpc.status.INTERNAL,
};

const codeToHttp: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
  }

  toGrpc(): grpc.ServiceError {
    const err = new Error(this.message) as grpc.ServiceError;
    err.code = codeToGrpc[this.code];
    err.details = this.message;
    err.metadata = new grpc.Metadata();
    err.metadata.add('app-code', this.code);
    return err;
  }

  get httpStatus(): number {
    return codeToHttp[this.code];
  }
}

// Translate a gRPC error coming from a downstream service into an AppError.
export function grpcErrorToApp(err: grpc.ServiceError): AppError {
  const appCode = (err.metadata?.get('app-code')?.[0] as ErrorCode) ?? undefined;
  if (appCode) return new AppError(appCode, err.details ?? err.message);
  switch (err.code) {
    case grpc.status.INVALID_ARGUMENT:
      return new AppError('BAD_REQUEST', err.details ?? err.message);
    case grpc.status.UNAUTHENTICATED:
      return new AppError('UNAUTHENTICATED', err.details ?? err.message);
    case grpc.status.PERMISSION_DENIED:
      return new AppError('FORBIDDEN', err.details ?? err.message);
    case grpc.status.NOT_FOUND:
      return new AppError('NOT_FOUND', err.details ?? err.message);
    case grpc.status.ALREADY_EXISTS:
      return new AppError('CONFLICT', err.details ?? err.message);
    default:
      return new AppError('INTERNAL', err.details ?? err.message ?? 'Internal error');
  }
}
