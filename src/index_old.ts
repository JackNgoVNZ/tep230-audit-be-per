import 'reflect-metadata';
import './common/types/express-augment';
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { AppDataSource } from './config/database';
import { LocalDataSource } from './config/local-database';
import { seedLocalData } from './config/seed-local-data';
import { appConfig } from './config/app';
import { logger } from './middleware/logger.middleware';
import { registerJobs } from './jobs';

async function bootstrap() {
  try {
    // Connect to MySQL database
    await AppDataSource.initialize();
    logger.info('MySQL database connected successfully');

    // Connect to local SQLite database (supplementary tables)
    await LocalDataSource.initialize();
    logger.info('Local SQLite database connected');
    await seedLocalData();

    // Register scheduled jobs
    registerJobs();

    // Start server
    app.listen(appConfig.port, () => {
      logger.info(`Server running on port ${appConfig.port}`);
      logger.info(`Swagger docs: http://localhost:${appConfig.port}/api/docs`);
      logger.info(`Environment: ${appConfig.nodeEnv}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

bootstrap();
