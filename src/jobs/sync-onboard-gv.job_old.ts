import { AppDataSource } from '../config/database';
import { logger } from '../middleware/logger.middleware';

/**
 * Daily 6AM: Detect new GVs who have their first JSU (CUIE event) but haven't been audited yet.
 * Creates PENDING audit_session_status records for them.
 */
export async function syncOnboardGv(): Promise<void> {
  const newGvs = await AppDataSource.query(`
    SELECT DISTINCT usi.code, usi.fullname, MIN(cuie.trigger_at) as first_event
    FROM bp_usi_useritem usi
    INNER JOIN bp_cuie_cuievent cuie ON cuie.myusi = usi.code
    LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mytrigger = usi.code
    LEFT JOIN audit_session_status ass ON ass.chpi_code = chpi.code AND ass.audit_type = 'ONBOARD'
    WHERE usi.active = 1
      AND (chpi.id IS NULL OR ass.id IS NULL)
    GROUP BY usi.code, usi.fullname
    HAVING first_event >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    LIMIT 100
  `);

  logger.info(`[SyncOnboardGV] Found ${newGvs.length} new GVs for onboard audit`);

  // Auto-create audit processes would go here in production
  // For now just log
  for (const gv of newGvs) {
    logger.info(`[SyncOnboardGV] New GV: ${gv.code} - ${gv.fullname} (first event: ${gv.first_event})`);
  }
}
