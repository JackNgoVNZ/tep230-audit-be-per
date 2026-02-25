import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app';
import { AppDataSource } from '../src/config/database';

// Initialize DB once per cold start
let initialized = false;
async function ensureInit() {
  if (!initialized && !AppDataSource.isInitialized) {
    try {
      await AppDataSource.initialize();
      initialized = true;
    } catch (err) {
      console.error('[Vercel] DB init failed:', err);
      // Don't throw — let the request proceed, health endpoint will show disconnected
    }
  }
}

export default async function handler(req: any, res: any) {
  try {
    await ensureInit();
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel] Handler error:', err);
    res.status(500).json({
      status: 'error',
      message: err?.message || 'Serverless function failed',
    });
  }
}
