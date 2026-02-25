import { AppDataSource } from '../../config/database';
import { localQuery } from '../../config/local-query';
import { AppError } from '../../middleware/error-handler.middleware';

export class UserService {
  /**
   * List users with pagination and optional role filter
   */
  async listUsers(page: number, limit: number, role?: string, search?: string) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let where = 'WHERE usi.active = 1';

    if (role) {
      where += ' AND usi.myust = ?';
      params.push(role);
    }
    if (search) {
      where += ' AND (usi.fullname LIKE ? OR usi.email LIKE ? OR usi.code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const query = `
      SELECT
        usi.id, usi.code, usi.username, usi.fullname, usi.displayname,
        usi.email, usi.clevai_email, usi.phone, usi.avatar,
        usi.myust, usi.myparent, usi.active, usi.created_at,
        ust.name as user_type_name
      FROM bp_usi_useritem usi
      LEFT JOIN bp_ust_usertype ust ON ust.code = usi.myust
      ${where}
      ORDER BY usi.fullname ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bp_usi_useritem usi
      ${where}
    `;

    params.push(limit, offset);
    const countParams = params.slice(0, -2);

    const [data, countResult] = await Promise.all([
      AppDataSource.query(query, params),
      AppDataSource.query(countQuery, countParams),
    ]);

    return { data, total: countResult[0]?.total || 0 };
  }

  /**
   * Get user detail by code
   */
  async getUserDetail(code: string) {
    const rows = await AppDataSource.query(
      `SELECT
        usi.id, usi.code, usi.username, usi.fullname, usi.displayname,
        usi.firstname, usi.lastname, usi.email, usi.clevai_email,
        usi.phone, usi.avatar, usi.birthday, usi.job, usi.address,
        usi.gender, usi.myust, usi.myparent, usi.active, usi.created_at,
        ust.name as user_type_name
       FROM bp_usi_useritem usi
       LEFT JOIN bp_ust_usertype ust ON ust.code = usi.myust
       WHERE usi.code = ?`,
      [code]
    );
    if (!rows.length) throw new AppError('User not found', 404);
    return rows[0];
  }

  /**
   * Get user's audit history
   */
  async getUserAuditHistory(usiCode: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    // Step 1: MySQL - get CHPI codes for this user (as trigger/GV)
    const chpiRows: any[] = await AppDataSource.query(
      `SELECT chpi.code, chpi.name as process_name, chpi.mychecker as auditor_code,
              usi_aud.fullname as auditor_name
       FROM bp_chpi_checkprocessitem chpi
       LEFT JOIN bp_usi_useritem usi_aud ON usi_aud.code = chpi.mychecker
       WHERE chpi.mytrigger = ?`,
      [usiCode]
    );

    if (!chpiRows.length) return { data: [], total: 0 };

    const chpiCodes = chpiRows.map((r: any) => r.code);
    const chpiMap = new Map(chpiRows.map((r: any) => [r.code, r]));

    // Step 2: SQLite - get session statuses for those CHPI codes
    const placeholders = chpiCodes.map(() => '?').join(',');
    const allSessions: any[] = await localQuery(
      `SELECT id, chpi_code, audit_type, status, total_score, max_score, threshold_result,
              is_second_audit, assigned_at, started_at, completed_at, created_at
       FROM audit_session_status
       WHERE chpi_code IN (${placeholders})
       ORDER BY created_at DESC`,
      chpiCodes
    );

    const total = allSessions.length;

    // Step 3: Paginate and merge in JS
    const paginated = allSessions.slice(offset, offset + limit);
    const data = paginated.map((session: any) => {
      const chpi = chpiMap.get(session.chpi_code) || {};
      return {
        ...session,
        process_name: chpi.process_name || null,
        auditor_code: chpi.auditor_code || null,
        auditor_name: chpi.auditor_name || null,
      };
    });

    return { data, total };
  }

  /**
   * Get user statistics
   */
  async getUserStats(usiCode: string) {
    // Step 1: MySQL - get CHPI codes for this user
    const chpiRows: any[] = await AppDataSource.query(
      'SELECT code FROM bp_chpi_checkprocessitem WHERE mytrigger = ?',
      [usiCode]
    );
    const chpiCodes = chpiRows.map((r: any) => r.code);

    if (!chpiCodes.length) {
      return {
        usiCode,
        summary: { total_audits: 0, completed_audits: 0, in_progress_audits: 0, pending_audits: 0,
                    pass_count: 0, retrain_count: 0, terminate_count: 0,
                    avg_score: null, min_score: null, max_score: null },
        byType: [],
      };
    }

    // Step 2: SQLite - get session statuses
    const placeholders = chpiCodes.map(() => '?').join(',');
    const sessions: any[] = await localQuery(
      `SELECT audit_type, status, total_score, threshold_result
       FROM audit_session_status WHERE chpi_code IN (${placeholders})`,
      chpiCodes
    );

    // Step 3: Compute stats in JS
    let total_audits = sessions.length;
    let completed_audits = 0, in_progress_audits = 0, pending_audits = 0;
    let pass_count = 0, retrain_count = 0, terminate_count = 0;
    let scoreSum = 0, scoreCount = 0;
    let min_score: number | null = null, max_score: number | null = null;

    const typeMap = new Map<string, { count: number; scoreSum: number; scoreCount: number }>();

    for (const s of sessions) {
      if (s.status === 'COMPLETED') completed_audits++;
      if (s.status === 'IN_PROGRESS') in_progress_audits++;
      if (s.status === 'PENDING') pending_audits++;
      if (s.threshold_result === 'PASS') pass_count++;
      if (s.threshold_result === 'RETRAIN') retrain_count++;
      if (s.threshold_result === 'TERMINATE') terminate_count++;
      if (s.total_score != null) {
        const score = Number(s.total_score);
        scoreSum += score; scoreCount++;
        if (min_score === null || score < min_score) min_score = score;
        if (max_score === null || score > max_score) max_score = score;
      }
      // by type
      if (!typeMap.has(s.audit_type)) typeMap.set(s.audit_type, { count: 0, scoreSum: 0, scoreCount: 0 });
      const t = typeMap.get(s.audit_type)!;
      t.count++;
      if (s.total_score != null) { t.scoreSum += Number(s.total_score); t.scoreCount++; }
    }

    const summary = {
      total_audits, completed_audits, in_progress_audits, pending_audits,
      pass_count, retrain_count, terminate_count,
      avg_score: scoreCount > 0 ? scoreSum / scoreCount : null,
      min_score, max_score,
    };

    const byType = Array.from(typeMap.entries()).map(([audit_type, t]) => ({
      audit_type,
      count: t.count,
      avg_score: t.scoreCount > 0 ? t.scoreSum / t.scoreCount : null,
    }));

    return { usiCode, summary, byType };
  }
}
