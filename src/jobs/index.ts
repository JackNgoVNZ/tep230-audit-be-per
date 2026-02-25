import cron from 'node-cron';
import { syncOnboardGv } from './sync-onboard-gv.job';
import { syncHotcaseGv } from './sync-hotcase-gv.job';
import { syncWeeklyGv } from './sync-weekly-gv.job';
import { syncMonthlyGv } from './sync-monthly-gv.job';
import { autoAssignAuditor } from './auto-assign-auditor.job';
import { sendReminder } from './send-reminder.job';
import { cleanupOldData } from './cleanup-old-data.job';
import { activateRetraining } from './activate-retraining.job';

export function registerJobs(): void {
  cron.schedule('0 6 * * *', async () => {
    console.log('[JOB] SyncOnboardGV started');
    try {
      await syncOnboardGv();
    } catch (e: any) {
      console.error(`[JOB] SyncOnboardGV failed: ${e.message}`);
    }
  });

  cron.schedule('0 * * * *', async () => {
    console.log('[JOB] SyncHotcaseGV started');
    try {
      await syncHotcaseGv();
    } catch (e: any) {
      console.error(`[JOB] SyncHotcaseGV failed: ${e.message}`);
    }
  });

  cron.schedule('0 6 * * 1', async () => {
    console.log('[JOB] SyncWeeklyGV started');
    try {
      await syncWeeklyGv();
    } catch (e: any) {
      console.error(`[JOB] SyncWeeklyGV failed: ${e.message}`);
    }
  });

  cron.schedule('0 6 1 * *', async () => {
    console.log('[JOB] SyncMonthlyGV started');
    try {
      await syncMonthlyGv();
    } catch (e: any) {
      console.error(`[JOB] SyncMonthlyGV failed: ${e.message}`);
    }
  });

  cron.schedule('0 7 * * *', async () => {
    console.log('[JOB] AutoAssignAuditor started');
    try {
      await autoAssignAuditor();
    } catch (e: any) {
      console.error(`[JOB] AutoAssignAuditor failed: ${e.message}`);
    }
  });

  cron.schedule('0 9 * * *', async () => {
    console.log('[JOB] SendReminder started');
    try {
      await sendReminder();
    } catch (e: any) {
      console.error(`[JOB] SendReminder failed: ${e.message}`);
    }
  });

  cron.schedule('0 3 1 * *', async () => {
    console.log('[JOB] CleanupOldData started');
    try {
      await cleanupOldData();
    } catch (e: any) {
      console.error(`[JOB] CleanupOldData failed: ${e.message}`);
    }
  });

  cron.schedule('0 6 * * *', async () => {
    console.log('[JOB] ActivateRetraining started');
    try {
      await activateRetraining();
    } catch (e: any) {
      console.error(`[JOB] ActivateRetraining failed: ${e.message}`);
    }
  });

  console.log('Scheduled jobs registered');
}
