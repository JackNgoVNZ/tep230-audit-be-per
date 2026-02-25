import { AppDataSource } from '../config/database';
import { logger } from '../middleware/logger.middleware';

/**
 * Daily 7AM: Auto-assign auditors to unassigned audit processes using round-robin workload balancing.
 */
export async function autoAssignAuditor(): Promise<void> {
  // Get pending unassigned processes
  const pending = await AppDataSource.query(`
    SELECT ass.chpi_code, ass.audit_type
    FROM audit_session_status ass
    INNER JOIN bp_chpi_checkprocessitem chpi ON chpi.code = ass.chpi_code
    WHERE ass.status = 'PENDING'
      AND chpi.mychecker IS NULL
    ORDER BY ass.created_at ASC
    LIMIT 50
  `);

  if (!pending.length) {
    logger.info('[AutoAssignAuditor] No pending audits to assign');
    return;
  }

  // Get available auditors with their current workload
  const auditors = await AppDataSource.query(`
    SELECT chri.myusi as code, usi.fullname,
           COUNT(DISTINCT active_ass.id) as current_workload
    FROM bp_chri_checkeritem chri
    INNER JOIN bp_usi_useritem usi ON usi.code = chri.myusi
    LEFT JOIN bp_chpi_checkprocessitem active_chpi ON active_chpi.mychecker = chri.myusi
    LEFT JOIN audit_session_status active_ass ON active_ass.chpi_code = active_chpi.code
      AND active_ass.status IN ('ASSIGNED', 'IN_PROGRESS')
    WHERE usi.active = 1
    GROUP BY chri.myusi, usi.fullname
    ORDER BY current_workload ASC
  `);

  if (!auditors.length) {
    logger.info('[AutoAssignAuditor] No available auditors');
    return;
  }

  // Round-robin assignment
  let auditorIdx = 0;
  for (const process of pending) {
    const auditor = auditors[auditorIdx % auditors.length];

    await AppDataSource.query(
      'UPDATE bp_chpi_checkprocessitem SET mychecker = ?, updated_at = NOW() WHERE code = ?',
      [auditor.code, process.chpi_code]
    );
    await AppDataSource.query(
      `UPDATE audit_session_status SET status = 'ASSIGNED', assigned_at = NOW(), updated_at = NOW() WHERE chpi_code = ?`,
      [process.chpi_code]
    );
    await AppDataSource.query(
      'UPDATE bp_chsi_checkstepitem SET mychri = ?, updated_at = NOW() WHERE mychpi = ?',
      [auditor.code, process.chpi_code]
    );

    logger.info(`[AutoAssignAuditor] Assigned ${process.chpi_code} to ${auditor.fullname}`);
    auditorIdx++;
  }

  logger.info(`[AutoAssignAuditor] Assigned ${pending.length} audits to ${auditors.length} auditors`);
}
