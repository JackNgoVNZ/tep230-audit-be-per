import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app';
import { AppDataSource } from '../src/config/database';

// Initialize DB once per cold start
let initialized = false;
async function ensureInit() {
  if (!initialized && !AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    initialized = true;
  }
}

export default async function handler(req: any, res: any) {
  await ensureInit();
  return app(req, res);
}
