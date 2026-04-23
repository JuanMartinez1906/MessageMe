import sharp from 'sharp';
import { createLogger } from '@messageme/shared';
import { config } from './config';
import { downloadObject, uploadObject } from './s3';
import { publishMediaReady, FileUploadedEvent } from './kafka';

const log = createLogger('media-processor:processor');

// Only these mimes get a thumbnail. Everything else emits a READY event with
// thumbnail_key=null so file-service can still flip the file to READY.
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/tiff',
]);

function thumbnailKey(storageKey: string, fileId: string): string {
  // Keep thumbnails namespaced alongside uploads so bucket lifecycle rules can
  // target them. Derives from storage prefix when possible.
  const parts = storageKey.split('/');
  if (parts[0] === 'uploads' && parts.length >= 3) {
    return `thumbnails/${parts[1]}/${fileId}.webp`;
  }
  return `thumbnails/${fileId}.webp`;
}

export async function processFileUploaded(event: FileUploadedEvent): Promise<void> {
  const p = event.payload;

  if (!IMAGE_MIMES.has(p.mime_type)) {
    // Non-image: nothing to do, but still announce READY so downstream systems
    // can unblock the file (e.g. file-service marking status=READY).
    await publishMediaReady({
      fileId: p.file_id,
      status: 'READY',
      thumbnailKey: null,
      width: null,
      height: null,
      error: null,
    });
    log.info({ fileId: p.file_id, mime: p.mime_type }, 'non-image, marked ready without thumbnail');
    return;
  }

  try {
    const original = await downloadObject(p.storage_key);
    const pipeline = sharp(original, { failOn: 'none' })
      .rotate() // apply EXIF orientation before resize
      .resize({
        width: config.thumbnailMaxWidth,
        height: config.thumbnailMaxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: config.thumbnailQuality });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    const key = thumbnailKey(p.storage_key, p.file_id);
    await uploadObject({ key, body: data, contentType: 'image/webp' });

    await publishMediaReady({
      fileId: p.file_id,
      status: 'READY',
      thumbnailKey: key,
      width: info.width,
      height: info.height,
      error: null,
    });
    log.info(
      { fileId: p.file_id, thumbnailKey: key, width: info.width, height: info.height },
      'thumbnail ready'
    );
  } catch (err: any) {
    log.error({ err, fileId: p.file_id }, 'processing failed');
    await publishMediaReady({
      fileId: p.file_id,
      status: 'FAILED',
      thumbnailKey: null,
      width: null,
      height: null,
      error: err?.message ?? 'processing error',
    });
  }
}
