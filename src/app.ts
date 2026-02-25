import express from 'express';
import cors from 'cors';
import './common/types/express-augment';
import { AppDataSource } from './config/database';
import authRouter from './modules/auth/auth.router';
import userRouter from './modules/user/user.router';
import settingsRouter from './modules/settings/settings.router';
import thresholdRouter from './modules/threshold/threshold.router';
import auditProcessRouter from './modules/audit-process/audit-process.router';
import gvFilterRouter from './modules/gv-filter/gv-filter.router';
import auditorAssignmentRouter from './modules/auditor-assignment/auditor-assignment.router';
import checklistRouter from './modules/checklist/checklist.router';
import auditStepRouter from './modules/audit-step/audit-step.router';
import scoringRouter from './modules/scoring/scoring.router';
import emailRouter from './modules/email/email.router';
import notificationRouter from './modules/notification/notification.router';
import videoRouter from './modules/video/video.router';
import supervisorRouter from './modules/supervisor-assignment/supervisor-assignment.router';
import jobsRouter from './modules/jobs/jobs.router';

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost dev
    if (origin.includes('localhost')) return callback(null, true);
    // Allow all vercel.app domains (production + preview deployments)
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow explicit FRONTEND_URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/thresholds', thresholdRouter);
app.use('/api/audit-processes', auditProcessRouter);
app.use('/api/gv-filter', gvFilterRouter);
app.use('/api/auditors', auditorAssignmentRouter);
app.use('/api/checklists', checklistRouter);
app.use('/api/audit-steps', auditStepRouter);
app.use('/api/scoring', scoringRouter);
app.use('/api/email', emailRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/video', videoRouter);
app.use('/api/supervisors', supervisorRouter);
app.use('/api/jobs', jobsRouter);


app.get('/api/health', async (_req, res) => {
  let db = 'disconnected';
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.query('SELECT 1');
      db = 'connected';
    }
  } catch {
    db = 'disconnected';
  }
  res.json({ status: 'ok', db, timestamp: new Date().toISOString() });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    if (!AppDataSource.isInitialized) {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        error: 'Database not initialized',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    await AppDataSource.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Global error handler — prevent stack trace leaks
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode < 500 ? err.message : 'Internal server error';
  console.error('[ERROR]', err.message || err);
  res.status(statusCode).json({ success: false, message });
});

export default app;
