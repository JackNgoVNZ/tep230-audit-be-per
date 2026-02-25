import { AppDataSource } from '../config/database';

export async function activateRetraining(): Promise<number> {
  // Activate retraining CHPIs that were scheduled (RETRAINING type with Assigned status older than 7 days)
  const result = await AppDataSource.query(
    `UPDATE bp_chpi_checkprocessitem
     SET status = 'Assigned'
     WHERE mychpttype = 'RTR-AUDIT' AND status = 'Open'
       AND created_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)`
  );

  const affected = result?.affectedRows || 0;
  console.log(`[JOB] ActivateRetraining: ${affected} sessions activated`);
  return affected;
}
