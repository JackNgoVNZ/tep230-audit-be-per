import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { AppDataSource } from './config/database';
import { registerJobs } from './jobs';
import { validateEnv } from './config/validate-env';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    await AppDataSource.initialize();
    console.log('MySQL database connected successfully');

    registerJobs();

    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`DB health: http://localhost:${PORT}/api/health/db`);
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

bootstrap();
