import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { databaseStatus, probeDatabase } from './lib/database';
import { UPLOAD_DIR } from './middleware/upload';
import { billRouter } from './routes/billRoutes';
import { businessRouter } from './routes/businessRoutes';
import { HttpError } from './utils/http';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(UPLOAD_DIR));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'BahiVerse Backend',
      database: databaseStatus(),
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/bills', billRouter);
  app.use('/api/businesses', businessRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found.' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        error: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
      });
      return;
    }

    if (error instanceof multer.MulterError) {
      const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      const statusCode = (error as { statusCode?: unknown }).statusCode;
      if (typeof statusCode === 'number') {
        res.status(statusCode).json({
          error: error instanceof Error ? error.message : 'Request failed.'
        });
        return;
      }
    }

    console.error('[BahiVerse] Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

export async function startServer(port = Number(process.env.PORT) || 5000) {
  const app = createApp();

  if (process.env.DATABASE_URL) {
    const connected = await probeDatabase();
    console.log(
      connected
        ? '[BahiVerse] Connected to PostgreSQL via Prisma.'
        : '[BahiVerse] Database unavailable; serving in-memory demo data.'
    );
  } else {
    console.log('[BahiVerse] DATABASE_URL not set; serving in-memory demo data.');
  }

  return app.listen(port, () => {
    console.log(`BahiVerse API listening on port ${port}`);
  });
}
