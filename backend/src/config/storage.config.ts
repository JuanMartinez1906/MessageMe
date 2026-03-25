import path from 'path';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_AUDIO_MIMES = ['audio/mpeg', 'audio/ogg', 'audio/mp4'];

export const ALLOWED_MIMES = [
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_DOC_MIMES,
  ...ALLOWED_AUDIO_MIMES,
];

export function getMessageType(mime: string): 'IMAGE' | 'FILE' | 'AUDIO' {
  if (ALLOWED_IMAGE_MIMES.includes(mime)) return 'IMAGE';
  if (ALLOWED_AUDIO_MIMES.includes(mime)) return 'AUDIO';
  return 'FILE';
}

/** Returns uploads/YYYY/MM/DD relative path segment */
export function getDatePath(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return path.join(String(y), m, d);
}
