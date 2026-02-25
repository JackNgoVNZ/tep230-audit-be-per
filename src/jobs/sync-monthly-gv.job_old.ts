import { AppDataSource } from '../config/database';
import { logger } from '../middleware/logger.middleware';

/**
 * Monthly 1st: Inherit from WEEKLY results or random select for monthly audit.
 */
export async function syncMonthlyGv(): Promise<void> {
  // Find GVs with completed weekly audits this month
  const weeklyResults = await AppDataSource.query(`
    SELECT DISTINCT chpi.mytrigger as gv_code,
           usi.fullname,
           ass.total_score, ass.threshold_result, ass.chpi_code
    FROM audit_session_status ass
    INNER JOIN bp_chpi_checkprocessitem chpi ON chpi.code = ass.chpi_code
    INNER JOIN bp_usi_useritem usi ON usi.code = chpi.mytrigger
    WHERE ass.audit_type = 'WEEKLY'
      AND ass.status = 'COMPLETED'
      AND ass.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ORDER BY ass.completed_at DESC
  `);

  logger.info(`[SyncMonthlyGV] Found ${weeklyResults.length} weekly results to inherit for monthly audit`);
}
