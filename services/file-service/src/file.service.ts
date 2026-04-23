import { AppError } from '@messageme/shared';
import { File, FileStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { presignPut, presignGet, headObject } from './s3';
import { publishFileUploaded, MediaReadyEvent } from './kafka';

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB MVP ceiling

function sanitizeName(name: string): string {
  // Keep file traversal and whitespace out of the S3 key — the original name is
  // still persisted in the DB row.
  const trimmed = name.trim().slice(0, 120);
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'file';
}

function buildStorageKey(ownerId: string, fileId: string, originalName: string): string {
  return `uploads/${ownerId}/${fileId}-${sanitizeName(originalName)}`;
}

export const fileService = {
  async createUpload(args: {
    ownerId: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string;
  }): Promise<{ file: File; uploadUrl: string; expiresAt: Date }> {
    if (!args.ownerId) throw new AppError('BAD_REQUEST', 'ownerId required');
    if (!args.mimeType) throw new AppError('BAD_REQUEST', 'mimeType required');
    if (!args.originalName) throw new AppError('BAD_REQUEST', 'originalName required');
    if (args.sizeBytes <= 0) throw new AppError('BAD_REQUEST', 'sizeBytes must be positive');
    if (args.sizeBytes > MAX_SIZE_BYTES) {
      throw new AppError('BAD_REQUEST', `file exceeds max size of ${MAX_SIZE_BYTES} bytes`);
    }

    const fileId = randomUUID();
    const storageKey = buildStorageKey(args.ownerId, fileId, args.originalName);

    const file = await prisma.file.create({
      data: {
        fileId,
        ownerId: args.ownerId,
        mimeType: args.mimeType,
        sizeBytes: BigInt(args.sizeBytes),
        originalName: args.originalName,
        storageKey,
        status: FileStatus.PENDING,
      },
    });

    const { url, expiresAt } = await presignPut({ key: storageKey, contentType: args.mimeType });
    return { file, uploadUrl: url, expiresAt };
  },

  async confirmUpload(args: { fileId: string; ownerId: string }): Promise<File> {
    const file = await prisma.file.findUnique({ where: { fileId: args.fileId } });
    if (!file) throw new AppError('NOT_FOUND', 'file not found');
    if (file.ownerId !== args.ownerId) throw new AppError('FORBIDDEN', 'not your file');

    // Already past PENDING — just return the current record (idempotent).
    if (file.status !== FileStatus.PENDING) return file;

    const head = await headObject(file.storageKey);
    if (!head) throw new AppError('NOT_FOUND', 'upload not found in storage');

    // Trust S3's content length over the client-reported size.
    const updated = await prisma.file.update({
      where: { fileId: file.fileId },
      data: { status: FileStatus.UPLOADED, sizeBytes: BigInt(head.size) },
    });

    await publishFileUploaded({
      fileId: updated.fileId,
      ownerId: updated.ownerId,
      storageKey: updated.storageKey,
      mimeType: updated.mimeType,
      sizeBytes: Number(updated.sizeBytes),
      originalName: updated.originalName,
      uploadedAt: updated.updatedAt,
    });

    return updated;
  },

  async getDownloadUrl(args: {
    fileId: string;
    requestedBy: string;
  }): Promise<{ url: string; expiresAt: Date }> {
    const file = await prisma.file.findUnique({ where: { fileId: args.fileId } });
    if (!file) throw new AppError('NOT_FOUND', 'file not found');
    // Any authenticated user can request a download URL. Hardening to
    // channel/conversation membership requires a gRPC call from here into
    // message-service / group-service; tracked for a later phase.
    if (!args.requestedBy) {
      throw new AppError('UNAUTHENTICATED', 'authentication required');
    }
    if (file.status === FileStatus.PENDING) {
      throw new AppError('BAD_REQUEST', 'file upload not confirmed yet');
    }
    return presignGet(file.storageKey);
  },

  async getFile(fileId: string): Promise<File> {
    const file = await prisma.file.findUnique({ where: { fileId } });
    if (!file) throw new AppError('NOT_FOUND', 'file not found');
    return file;
  },

  // Called from the media.ready consumer. Idempotent upsert of the processing
  // outcome — status/thumbnailKey may arrive before or after the client pulls.
  async applyMediaReady(event: MediaReadyEvent): Promise<void> {
    const p = event.payload;
    const existing = await prisma.file.findUnique({ where: { fileId: p.file_id } });
    if (!existing) return; // unknown file — nothing to update.

    const nextStatus = p.status === 'READY' ? FileStatus.READY : FileStatus.FAILED;
    // Monotonic: never regress a READY row back to FAILED for a retried event.
    if (existing.status === FileStatus.READY && nextStatus === FileStatus.FAILED) return;

    const data: Prisma.FileUpdateInput = { status: nextStatus };
    if (p.thumbnail_key !== undefined) data.thumbnailKey = p.thumbnail_key;
    if (p.width !== undefined) data.width = p.width;
    if (p.height !== undefined) data.height = p.height;

    await prisma.file.update({ where: { fileId: p.file_id }, data });
  },
};
