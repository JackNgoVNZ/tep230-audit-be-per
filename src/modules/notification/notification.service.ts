import { AppDataSource } from '../../config/database';
import { localQuery } from '../../config/local-query';

export class NotificationService {
  async listNotifications(userCode: string) {
    // Query 1: Audit session status changes from MySQL CHPI
    const sessions = await AppDataSource.query(
      `SELECT chpi.code AS chpi_code, chpi.mychpttype AS audit_type, chpi.status, chpi.created_at
       FROM bp_chpi_checkprocessitem chpi
       WHERE chpi.mytrigger = ? OR chpi.mychecker = ?
       ORDER BY chpi.created_at DESC
       LIMIT 50`,
      [userCode, userCode]
    );

    // Query 2: Feedback relevant to the user
    const feedbacks = await localQuery(
      'SELECT id, code, chpi_code, feedback_type, status, created_at FROM audit_feedback WHERE gv_usi_code = ? OR reviewer_usi_code = ? ORDER BY created_at DESC LIMIT 50',
      [userCode, userCode]
    );

    // Map to notification format
    const sessionNotifs = (sessions || []).map((s: any, idx: number) => ({
      id: idx + 1,
      title: `Audit ${s.audit_type} - ${s.status || 'New'}`,
      message: `Process ${s.chpi_code} status: ${s.status || 'New'}`,
      notification_type: 'AUDIT_STATUS',
      is_read: 0,
      created_at: s.created_at,
    }));

    const feedbackNotifs = (feedbacks || []).map((f: any) => ({
      id: f.id + 10000,
      title: `Feedback ${f.feedback_type}`,
      message: `Feedback on ${f.chpi_code} - Status: ${f.status}`,
      notification_type: 'FEEDBACK',
      is_read: 0,
      created_at: f.created_at,
    }));

    // Combine and sort by created_at DESC
    const all = [...sessionNotifs, ...feedbackNotifs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return all;
  }

  async markAsRead(id: number) {
    return { id, isRead: true };
  }
}
