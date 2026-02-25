import cron from 'node-cron';
import { logger } from '../middleware/logger.middleware';
import { syncOnboardGv } from './sync-onboard-gv.job';
import { syncWeeklyGv } from './sync-weekly-gv.job';
import { syncHotcaseGv } from './sync-hotcase-gv.job';
import { syncMonthlyGv } from './sync-monthly-gv.job';
import { autoAssignAuditor } from './auto-assign-auditor.job';
import { sendReminder } from './send-reminder.job';
import { calculateStats } from './calculate-stats.job';
import { cleanupOldData } from './cleanup-old-data.job';

export function registerJobs(): void {
  // Daily 6AM — Sync onboard GV
  cron.schedule('0 6 * * *', async () => {
    logger.info('[JOB] SyncOnboardGV started');
    try { await syncOnboardGv(); } catch (e: any) { logger.error(`[JOB] SyncOnboardGV failed: ${e.message}`); }
  });

  // Monday 6AM — Sync weekly GV (random 10%)
  cron.schedule('0 6 * * 1', async () => {
    logger.info('[JOB] SyncWeeklyGV started');
    try { await syncWeeklyGv(); } catch (e: any) { logger.error(`[JOB] SyncWeeklyGV failed: ${e.message}`); }
  });

  // Every hour — Sync hotcase GV
  cron.schedule('0 * * * *', async () => {
    logger.info('[JOB] SyncHotcaseGV started');
    try { await syncHotcaseGv(); } catch (e: any) { logger.error(`[JOB] SyncHotcaseGV failed: ${e.message}`); }
  });

  // Monthly 1st day 6AM — Sync monthly GV
  cron.schedule('0 6 1 * *', async () => {
    logger.info('[JOB] SyncMonthlyGV started');
    try { await syncMonthlyGv(); } catch (e: any) { logger.error(`[JOB] SyncMonthlyGV failed: ${e.message}`); }
  });

  // Daily 7AM — Auto assign auditors
  cron.schedule('0 7 * * *', async () => {
    logger.info('[JOB] AutoAssignAuditor started');
    try { await autoAssignAuditor(); } catch (e: any) { logger.error(`[JOB] AutoAssignAuditor failed: ${e.message}`); }
  });

  // Daily 9AM — Send reminders
  cron.schedule('0 9 * * *', async () => {
    logger.info('[JOB] SendReminder started');
    try { await sendReminder(); } catch (e: any) { logger.error(`[JOB] SendReminder failed: ${e.message}`); }
  });

  // Daily 11PM — Calculate stats
  cron.schedule('0 23 * * *', async () => {
    logger.info('[JOB] CalculateStats started');
    try { await calculateStats(); } catch (e: any) { logger.error(`[JOB] CalculateStats failed: ${e.message}`); }
  });

  // Monthly 1st day midnight — Cleanup old data
  cron.schedule('0 0 1 * *', async () => {
    logger.info('[JOB] CleanupOldData started');
    try { await cleanupOldData(); } catch (e: any) { logger.error(`[JOB] CleanupOldData failed: ${e.message}`); }
  });

  logger.info('All scheduled jobs registered');
}
