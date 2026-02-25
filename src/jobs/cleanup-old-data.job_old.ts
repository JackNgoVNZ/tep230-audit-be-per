import { AppDataSource } from '../config/database';
import { logger } from '../middleware/logger.middleware';

/**
 * Monthly: Clean up cancelled audit sessions older than 6 months.
 */
export async function cleanupOldData(): Promise<void> {
  const result = await AppDataSource.query(`
    SELECT COUNT(*) as count
    FROM audit_session_status
    WHERE status = 'CANCELLED'
      AND created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
  `);

  const count = result[0]?.count || 0;
  logger.info(`[CleanupOldData] Found ${count} cancelled sessions older than 6 months`);

  // In production, archive and delete old data
  // For safety, only log — actual cleanup requires explicit admin action
}
