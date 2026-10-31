import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type { Request } from 'express';

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/tiff': '.tiff',
  'image/bmp': '.bmp'
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    const extension =
      path.extname(file.originalname).toLowerCase() || MIME_EXTENSION[file.mimetype] || '.jpg';
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const isImage = file.mimetype.startsWith('image/') || Boolean(MIME_EXTENSION[file.mimetype]);
    if (!isImage) {
      const error = new Error('Only image uploads are allowed.') as Error & {
        statusCode?: number;
      };
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  }
});

export const uploadBillImage = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'bill', maxCount: 1 }
]);

export function pickUploadedFile(req: Request): Express.Multer.File | null {
  const files = req.files;
  if (!files) return null;
  if (Array.isArray(files)) return files[0] ?? null;

  const grouped = files as Record<string, Express.Multer.File[] | undefined>;
  for (const fieldName of ['image', 'file', 'bill']) {
    const match = grouped[fieldName]?.[0];
    if (match) return match;
  }
  return null;
}
