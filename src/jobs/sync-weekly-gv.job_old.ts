import { AppDataSource } from '../config/database';
import { logger } from '../middleware/logger.middleware';

/**
 * Monday 6AM: Random 10% of active GVs + random 1 JSU per GV for weekly audit.
 */
export async function syncWeeklyGv(): Promise<void> {
  // Get total active GV count
  const countResult = await AppDataSource.query(`
    SELECT COUNT(DISTINCT usi.code) as total
    FROM bp_usi_useritem usi
    INNER JOIN bp_cuie_cuievent cuie ON cuie.myusi = usi.code
    WHERE usi.active = 1
  `);

  const totalGvs = countResult[0]?.total || 0;
  const sampleSize = Math.max(1, Math.ceil(totalGvs * 0.1)); // 10%

  const selectedGvs = await AppDataSource.query(`
    SELECT DISTINCT usi.code, usi.fullname
    FROM bp_usi_useritem usi
    INNER JOIN bp_cuie_cuievent cuie ON cuie.myusi = usi.code
    WHERE usi.active = 1
      AND cuie.trigger_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ORDER BY RAND()
    LIMIT ?
  `, [sampleSize]);

  logger.info(`[SyncWeeklyGV] Selected ${selectedGvs.length}/${totalGvs} GVs (10% sample) for weekly audit`);
}
