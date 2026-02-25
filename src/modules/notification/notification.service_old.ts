import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error-handler.middleware';

export class NotificationService {
  /**
   * List notifications for a user
   * Uses audit_session_status + audit_feedback as notification sources
   */
  async listNotifications(userCode: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    // Combine audit status changes and feedback as notifications
    const query = `
      (SELECT
        ass.id, ass.chpi_code as reference_code,
        CONCAT('Audit ', ass.audit_type, ' - ', ass.status) as title,
        CONCAT('Process ', chpi.name, ' status changed to ', ass.status) as message,
        'AUDIT_STATUS' as notification_type,
        0 as is_read,
        ass.updated_at as created_at
       FROM audit_session_status ass
       INNER JOIN bp_chpi_checkprocessitem chpi ON chpi.code = ass.chpi_code
       WHERE chpi.mytrigger = ? OR chpi.mychecker = ?)
      UNION ALL
      (SELECT
        af.id, af.code as reference_code,
        CONCAT('Feedback ', af.feedback_type) as title,
        CONCAT('Feedback on process ', af.chpi_code, ' - Status: ', af.status) as message,
        'FEEDBACK' as notification_type,
        0 as is_read,
        af.updated_at as created_at
       FROM audit_feedback af
       WHERE af.gv_usi_code = ? OR af.reviewer_usi_code = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT
        (SELECT COUNT(*) FROM audit_session_status ass
         INNER JOIN bp_chpi_checkprocessitem chpi ON chpi.code = ass.chpi_code
         WHERE chpi.mytrigger = ? OR chpi.mychecker = ?)
        +
        (SELECT COUNT(*) FROM audit_feedback af
         WHERE af.gv_usi_code = ? OR af.reviewer_usi_code = ?)
      as total
    `;

    const [data, countResult] = await Promise.all([
      AppDataSource.query(query, [userCode, userCode, userCode, userCode, limit, offset]),
      AppDataSource.query(countQuery, [userCode, userCode, userCode, userCode]),
    ]);

    return { data, total: countResult[0]?.total || 0 };
  }

  /**
   * Mark notification as read
   * Since we use virtual notifications, this is a placeholder
   * In production, you would have a dedicated notifications table
   */
  async markAsRead(id: number, _userCode: string) {
    // For now, return success. In production with a dedicated notifications table:
    // await AppDataSource.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_code = ?', [id, userCode]);
    return { id, isRead: true };
  }
}
