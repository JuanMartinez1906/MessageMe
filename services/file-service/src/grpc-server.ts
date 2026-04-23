import * as grpc from '@grpc/grpc-js';
import { loadProto, resolveService, AppError, createLogger } from '@messageme/shared';
import { File, FileStatus } from '@prisma/client';
import { config } from './config';
import { fileService } from './file.service';

const log = createLogger('file-service');

const filePkg = loadProto('file.proto');
const FileServiceDef = (resolveService(filePkg, 'messageme.file.FileService') as any).service;

function toTimestamp(d: Date | null | undefined) {
  if (!d) return undefined;
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000).toString(), nanos: (ms % 1000) * 1_000_000 };
}

function statusToProto(s: FileStatus): string {
  return `FILE_STATUS_${s}`;
}

function fileToProto(f: File) {
  return {
    fileId: f.fileId,
    ownerId: f.ownerId,
    mimeType: f.mimeType,
    sizeBytes: Number(f.sizeBytes).toString(),
    originalName: f.originalName,
    storageKey: f.storageKey,
    thumbnailKey: f.thumbnailKey ?? '',
    status: statusToProto(f.status),
    createdAt: toTimestamp(f.createdAt),
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
  createUpload: guard(async (req: any) => {
    const { file, uploadUrl, expiresAt } = await fileService.createUpload({
      ownerId: req.ownerId,
      mimeType: req.mimeType,
      sizeBytes: Number(req.sizeBytes ?? 0),
      originalName: req.originalName,
    });
    return {
      fileId: file.fileId,
      uploadUrl,
      expiresAt: toTimestamp(expiresAt),
      storageKey: file.storageKey,
    };
  }),

  confirmUpload: guard(async (req: any) => {
    const f = await fileService.confirmUpload({ fileId: req.fileId, ownerId: req.ownerId });
    return fileToProto(f);
  }),

  getDownloadUrl: guard(async (req: any) => {
    const { url, expiresAt } = await fileService.getDownloadUrl({
      fileId: req.fileId,
      requestedBy: req.requestedBy,
    });
    return { downloadUrl: url, expiresAt: toTimestamp(expiresAt) };
  }),

  getFile: guard(async (req: any) => {
    const f = await fileService.getFile(req.fileId);
    return fileToProto(f);
  }),
};

export function startServer(): Promise<void> {
  const server = new grpc.Server();
  server.addService(FileServiceDef, impl as any);
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${config.grpcHost}:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        log.info({ port }, 'file-service gRPC listening');
        resolve();
      }
    );
  });
}
