import { Express } from 'express';
import authRouter from './modules/auth/auth.router';
import gvFilterRouter from './modules/gv-filter/gv-filter.router';
import auditProcessRouter from './modules/audit-process/audit-process.router';
import auditStepRouter from './modules/audit-step/audit-step.router';
import checklistRouter from './modules/checklist/checklist.router';
import scoringRouter from './modules/scoring/scoring.router';
import userRouter from './modules/user/user.router';
import auditorAssignmentRouter from './modules/auditor-assignment/auditor-assignment.router';
import thresholdRouter from './modules/threshold/threshold.router';
import feedbackRouter from './modules/feedback/feedback.router';
import retrainRouter from './modules/retrain/retrain.router';
import terminateRouter from './modules/terminate/terminate.router';
import videoRouter from './modules/video/video.router';
import emailRouter from './modules/email/email.router';
import notificationRouter from './modules/notification/notification.router';
import dashboardRouter from './modules/dashboard/dashboard.router';
import reportRouter from './modules/report/report.router';
import exportRouter from './modules/export/export.router';
import eventListenerRouter from './modules/event-listener/event-listener.router';
import settingsRouter from './modules/settings/settings.router';

export function registerRoutes(app: Express): void {
  // Auth (Module 1)
  app.use('/api/auth', authRouter);

  // GV Filter (Module 3)
  app.use('/api/gv-filter', gvFilterRouter);

  // Audit Process (Module 3b)
  app.use('/api/audit-processes', auditProcessRouter);

  // Audit Steps (Module 4)
  app.use('/api/audit-steps', auditStepRouter);

  // Checklists (Module 5)
  app.use('/api/checklists', checklistRouter);

  // Scoring (Module 6)
  app.use('/api/scoring', scoringRouter);

  // Users (Module 2)
  app.use('/api/users', userRouter);

  // Auditor Assignment (Module 8)
  app.use('/api/auditors', auditorAssignmentRouter);

  // Threshold Config (Module 9)
  app.use('/api/thresholds', thresholdRouter);

  // Feedback (Module 10)
  app.use('/api/feedback', feedbackRouter);

  // Retrain (Module 11)
  app.use('/api/retrain', retrainRouter);

  // Terminate (Module 12)
  app.use('/api/terminate', terminateRouter);

  // Video (Module 14)
  app.use('/api/video', videoRouter);

  // Email (Module 15)
  app.use('/api/email', emailRouter);

  // Notifications (Module 16)
  app.use('/api/notifications', notificationRouter);

  // Dashboard (Module 17)
  app.use('/api/dashboard', dashboardRouter);

  // Reports (Module 18)
  app.use('/api/reports', reportRouter);

  // Export (Module 19)
  app.use('/api/export', exportRouter);

  // Event Listener (Module 13)
  app.use('/api/events', eventListenerRouter);

  // Settings (Admin Templates)
  app.use('/api/settings', settingsRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
