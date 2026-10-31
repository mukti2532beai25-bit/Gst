import 'dotenv/config';
import { startServer } from './server';

startServer().catch((error) => {
  console.error('[BahiVerse] Failed to start server:', error);
  process.exit(1);
});
