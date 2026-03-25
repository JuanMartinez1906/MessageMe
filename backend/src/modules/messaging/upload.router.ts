import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { authMiddleware } from '../../middleware/auth.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';
import {
  UPLOAD_DIR,
  ALLOWED_IMAGE_MIMES,
  getMessageType,
  getDatePath,
} from '../../config/storage.config';

export const uploadRouter = Router();

uploadRouter.post(
  '/',
  authMiddleware,
  (req: Request, res: Response, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        res.status(400).json({ message: err.message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ message: 'No file provided' });
      return;
    }

    const { buffer, mimetype, originalname, size } = req.file;
    const isImage = ALLOWED_IMAGE_MIMES.includes(mimetype);
    const datePath = getDatePath();
    const destDir = path.join(UPLOAD_DIR, datePath);

    try {
      await fs.mkdir(destDir, { recursive: true });

      const fileId = randomUUID();
      const messageType = getMessageType(mimetype);

      if (isImage) {
        const filename = `${fileId}.webp`;
        const thumbFilename = `${fileId}-thumb.webp`;
        const filePath = path.join(destDir, filename);
        const thumbPath = path.join(destDir, thumbFilename);

        await sharp(buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(filePath);

        await sharp(buffer)
          .resize({ width: 200, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(thumbPath);

        const urlBase = `/uploads/${datePath.replace(/\\/g, '/')}`;

        res.json({
          url: `${urlBase}/${filename}`,
          thumbnailUrl: `${urlBase}/${thumbFilename}`,
          type: messageType,
          size,
          originalName: originalname,
        });
      } else {
        const ext = path.extname(originalname) || '';
        const filename = `${fileId}${ext}`;
        const filePath = path.join(destDir, filename);

        await fs.writeFile(filePath, buffer);

        const urlBase = `/uploads/${datePath.replace(/\\/g, '/')}`;

        res.json({
          url: `${urlBase}/${filename}`,
          thumbnailUrl: null,
          type: messageType,
          size,
          originalName: originalname,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  },
);
