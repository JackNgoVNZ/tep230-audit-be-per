import { AppDataSource } from '../config/database';
import { logger } from '../middleware/logger.middleware';

/**
 * Hourly: Detect new HOT events in CUIE that haven't been assigned to audit yet.
 */
export async function syncHotcaseGv(): Promise<void> {
  const hotEvents = await AppDataSource.query(`
    SELECT cuie.code, cuie.myusi, cuie.mylcet_lceventtype, cuie.trigger_at,
           usi.fullname
    FROM bp_cuie_cuievent cuie
    INNER JOIN bp_usi_useritem usi ON usi.code = cuie.myusi
    LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mycuievent = cuie.code
    WHERE cuie.mylcet_lceventtype LIKE '%HOT%'
      AND cuie.trigger_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      AND chpi.id IS NULL
      AND usi.active = 1
    ORDER BY cuie.trigger_at DESC
    LIMIT 50
  `);

  logger.info(`[SyncHotcaseGV] Found ${hotEvents.length} new HOT events in last hour`);
}
