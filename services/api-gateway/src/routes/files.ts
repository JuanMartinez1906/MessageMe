import { Router } from 'express';
import { file } from '../grpc-clients';
import { requireAuth } from '../middleware';

export const filesRouter = Router();

filesRouter.use(requireAuth());

function tsToIso(ts: any): string | null {
  if (!ts) return null;
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  if (seconds === 0 && nanos === 0) return null;
  return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

function statusFromProto(s: string): string {
  return (s ?? 'FILE_STATUS_UNSPECIFIED').replace(/^FILE_STATUS_/, '');
}

function toFileJson(f: any) {
  return {
    fileId: f.fileId,
    ownerId: f.ownerId,
    mimeType: f.mimeType,
    sizeBytes: Number(f.sizeBytes ?? 0),
    originalName: f.originalName,
    storageKey: f.storageKey,
    thumbnailKey: f.thumbnailKey || null,
    status: statusFromProto(f.status),
    createdAt: tsToIso(f.createdAt),
  };
}

// POST /api/files/uploads  { mimeType, sizeBytes, originalName }
filesRouter.post('/uploads', async (req, res, next) => {
  try {
    const r = await file.createUpload({
      ownerId: req.userId,
      mimeType: req.body.mimeType,
      sizeBytes: String(req.body.sizeBytes ?? 0),
      originalName: req.body.originalName,
    });
    res.status(201).json({
      fileId: r.fileId,
      uploadUrl: r.uploadUrl,
      expiresAt: tsToIso(r.expiresAt),
      storageKey: r.storageKey,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/files/:fileId/confirm
filesRouter.post('/:fileId/confirm', async (req, res, next) => {
  try {
    const r = await file.confirmUpload({ fileId: req.params.fileId, ownerId: req.userId });
    res.json(toFileJson(r));
  } catch (err) {
    next(err);
  }
});

// GET /api/files/:fileId
filesRouter.get('/:fileId', async (req, res, next) => {
  try {
    const r = await file.getFile({ fileId: req.params.fileId });
    res.json(toFileJson(r));
  } catch (err) {
    next(err);
  }
});

// GET /api/files/:fileId/download-url
filesRouter.get('/:fileId/download-url', async (req, res, next) => {
  try {
    const r = await file.getDownloadUrl({
      fileId: req.params.fileId,
      requestedBy: req.userId,
    });
    res.json({ downloadUrl: r.downloadUrl, expiresAt: tsToIso(r.expiresAt) });
  } catch (err) {
    next(err);
  }
});
