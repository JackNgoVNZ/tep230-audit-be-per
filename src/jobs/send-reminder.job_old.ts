import { AppDataSource } from '../config/database';
import { logger } from '../middleware/logger.middleware';

/**
 * Daily 9AM: Send email reminders to auditors with pending/in-progress audits.
 */
export async function sendReminder(): Promise<void> {
  const pendingAudits = await AppDataSource.query(`
    SELECT chpi.mychecker as auditor_code, usi.fullname as auditor_name,
           usi.email as auditor_email,
           COUNT(*) as pending_count,
           GROUP_CONCAT(ass.chpi_code) as audit_codes
    FROM audit_session_status ass
    INNER JOIN bp_chpi_checkprocessitem chpi ON chpi.code = ass.chpi_code
    INNER JOIN bp_usi_useritem usi ON usi.code = chpi.mychecker
    WHERE ass.status IN ('ASSIGNED', 'IN_PROGRESS')
      AND chpi.mychecker IS NOT NULL
    GROUP BY chpi.mychecker, usi.fullname, usi.email
    HAVING pending_count > 0
  `);

  logger.info(`[SendReminder] ${pendingAudits.length} auditors have pending audits`);

  // In production, integrate with nodemailer to send actual emails
  for (const auditor of pendingAudits) {
    logger.info(`[SendReminder] Reminder: ${auditor.auditor_name} has ${auditor.pending_count} pending audit(s)`);
  }
}
