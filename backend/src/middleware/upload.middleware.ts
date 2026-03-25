import multer from 'multer';
import { ALLOWED_MIMES, MAX_FILE_SIZE } from '../config/storage.config';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: images, pdf, doc, docx, mp3, ogg, m4a`));
    }
  },
}).single('file');
