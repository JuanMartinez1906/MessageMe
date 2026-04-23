import axios from 'axios';
import { api } from './api';

export type AttachmentType = 'IMAGE' | 'FILE' | 'AUDIO';

export interface UploadedAttachment {
  fileId: string;
  downloadUrl: string;
  originalName: string;
  mimeType: string;
  type: AttachmentType;
}

function classify(mimeType: string, name: string): AttachmentType {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  // The monolith classified `.mp3/.ogg/.m4a` as AUDIO even when the browser
  // reported application/octet-stream — keep that fallback.
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext && ['mp3', 'ogg', 'm4a', 'wav'].includes(ext)) return 'AUDIO';
  return 'FILE';
}

// Three-step presigned upload: request URL from api-gateway/file-service,
// PUT the bytes directly to S3 (bypassing our services), then confirm with
// file-service and fetch a signed download URL to render immediately.
export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  const mimeType = file.type || 'application/octet-stream';

  const { data: upload } = await api.post('/files/uploads', {
    mimeType,
    sizeBytes: file.size,
    originalName: file.name,
  });

  // PUT with the exact Content-Type used when signing, otherwise S3 rejects
  // the request with SignatureDoesNotMatch.
  await axios.put(upload.uploadUrl, file, {
    headers: { 'Content-Type': mimeType },
  });

  await api.post(`/files/${upload.fileId}/confirm`);
  const { data: download } = await api.get(`/files/${upload.fileId}/download-url`);

  return {
    fileId: upload.fileId,
    downloadUrl: download.downloadUrl,
    originalName: file.name,
    mimeType,
    type: classify(mimeType, file.name),
  };
}
