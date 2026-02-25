import { AppDataSource } from '../config/database';
import { getRedisClient } from '../config/redis';
import { logger } from '../middleware/logger.middleware';

/**
 * Daily 11PM: Pre-compute dashboard statistics and cache in Redis.
 */
export async function calculateStats(): Promise<void> {
  const stats = await AppDataSource.query(`
    SELECT
      COUNT(*) as total_audits,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
      AVG(CASE WHEN total_score IS NOT NULL THEN total_score END) as avg_score,
      SUM(CASE WHEN threshold_result = 'PASS' THEN 1 ELSE 0 END) as pass_count,
      SUM(CASE WHEN threshold_result = 'RETRAIN' THEN 1 ELSE 0 END) as retrain_count,
      SUM(CASE WHEN threshold_result = 'TERMINATE' THEN 1 ELSE 0 END) as terminate_count
    FROM audit_session_status
  `);

  const byType = await AppDataSource.query(`
    SELECT audit_type,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
      AVG(CASE WHEN total_score IS NOT NULL THEN total_score END) as avg_score
    FROM audit_session_status
    GROUP BY audit_type
  `);

  try {
    const redis = getRedisClient();
    await redis.set('dashboard:stats', JSON.stringify(stats[0]), 'EX', 86400);
    await redis.set('dashboard:byType', JSON.stringify(byType), 'EX', 86400);
    logger.info('[CalculateStats] Dashboard stats cached in Redis');
  } catch (e: any) {
    logger.warn(`[CalculateStats] Redis cache failed: ${e.message}, stats computed but not cached`);
  }

  logger.info(`[CalculateStats] Total: ${stats[0]?.total_audits || 0} audits`);
}
