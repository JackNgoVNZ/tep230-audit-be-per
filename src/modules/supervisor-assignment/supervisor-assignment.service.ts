import { AppDataSource } from '../../config/database';
import { AssignSupervisorInput } from './supervisor-assignment.schema';

export class SupervisorAssignmentService {
  async listAuditors() {
    const rows = await AppDataSource.query(
      `SELECT u.code, u.fullname, u.email
       FROM bp_usi_useritem u
       INNER JOIN bp_usid_usiduty d ON d.myusi = u.code
       WHERE d.myust = 'QA' AND u.active = 1
       ORDER BY u.fullname`
    );
    return rows;
  }

  async getCompletedSessions(auditorCode: string) {
    // Get completed sessions directly from MySQL CHPI
    const rows = await AppDataSource.query(
      `SELECT chpi.code AS chpi_code, chpi.name, chpi.mychpttype AS audit_type,
              chpi.mychecker, chpi.status, chpi.created_at AS completed_at,
              usi.fullname AS gv_name
       FROM bp_chpi_checkprocessitem chpi
       LEFT JOIN bp_usi_useritem usi ON usi.code = chpi.mytrigger
       WHERE chpi.mychecker = ? AND chpi.status = 'Audited'
       ORDER BY chpi.created_at DESC`,
      [auditorCode]
    );

    return rows.map((r: any) => ({
      chpi_code: r.chpi_code,
      name: r.name,
      gv_name: r.gv_name,
      audit_type: r.audit_type,
      total_score: null,
      threshold_result: null,
      supervisor_code: null,
      completed_at: r.completed_at,
    }));
  }

  async assign(input: AssignSupervisorInput) {
    const { chpiCodes, supervisorCode } = input;

    // Verify supervisor is a QAL user
    const qalCheck = await AppDataSource.query(
      `SELECT u.code FROM bp_usi_useritem u
       INNER JOIN bp_usid_usiduty d ON d.myusi = u.code
       WHERE u.code = ? AND d.myust = 'QS'`,
      [supervisorCode]
    );
    if (!qalCheck.length) {
      throw { statusCode: 400, message: 'Supervisor must be a QAL user' };
    }

    // Update supervisor on CHPI records directly in MySQL
    const placeholders = chpiCodes.map(() => '?').join(',');
    await AppDataSource.query(
      `UPDATE bp_chpi_checkprocessitem SET description = CONCAT(IFNULL(description, ''), ' [SUP:', ?, ']') WHERE code IN (${placeholders})`,
      [supervisorCode, ...chpiCodes]
    );

    return { updated: chpiCodes.length, supervisorCode };
  }

  async listAssignments(page: number, limit: number) {
    const offset = (page - 1) * limit;

    // Query completed CHPI records directly from MySQL
    const countResult = await AppDataSource.query(
      `SELECT COUNT(*) AS cnt FROM bp_chpi_checkprocessitem WHERE status = 'Audited'`
    );
    const total = Number(countResult[0]?.cnt || 0);

    if (total === 0) return { data: [], total: 0 };

    const rows = await AppDataSource.query(
      `SELECT chpi.code AS chpi_code, chpi.name, chpi.mychpttype AS audit_type,
              chpi.status, chpi.mychecker,
              gv.fullname AS gv_name, aud.fullname AS auditor_name
       FROM bp_chpi_checkprocessitem chpi
       LEFT JOIN bp_usi_useritem gv ON gv.code = chpi.mytrigger
       LEFT JOIN bp_usi_useritem aud ON aud.code = chpi.mychecker
       WHERE chpi.status = 'Audited'
       ORDER BY chpi.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return {
      data: rows.map((r: any) => ({
        chpi_code: r.chpi_code,
        name: r.name,
        gv_name: r.gv_name,
        auditor_name: r.auditor_name,
        audit_type: r.audit_type,
        status: r.status,
        supervisor_code: null,
        total_score: null,
      })),
      total,
    };
  }
}
