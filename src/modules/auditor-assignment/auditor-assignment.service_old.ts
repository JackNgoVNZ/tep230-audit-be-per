import { AppDataSource } from '../../config/database';
import { localQuery } from '../../config/local-query';
import { AppError } from '../../middleware/error-handler.middleware';

export class AuditorAssignmentService {
  /**
   * List auditors (users with QA/checker roles)
   */
  async listAuditors(page: number, limit: number, search?: string) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let searchWhere = '';

    if (search) {
      searchWhere = ' AND (usi.fullname LIKE ? OR usi.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Step 1: MySQL - get auditors with their CHPI assignments
    const query = `
      SELECT
        usi.id, usi.code, usi.fullname, usi.email, usi.phone, usi.avatar,
        usi.myust, ust.name as user_type_name,
        GROUP_CONCAT(DISTINCT chpi.code) as chpi_codes
      FROM bp_usi_useritem usi
      LEFT JOIN bp_ust_usertype ust ON ust.code = usi.myust
      LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mychecker = usi.code
      WHERE usi.active = 1
        AND (usi.myust LIKE '%qa%' OR usi.myust LIKE '%checker%' OR usi.myust LIKE '%QA%')
        ${searchWhere}
      GROUP BY usi.id, usi.code, usi.fullname, usi.email, usi.phone, usi.avatar, usi.myust, ust.name
      ORDER BY usi.fullname ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT usi.id) as total
      FROM bp_usi_useritem usi
      WHERE usi.active = 1
        AND (usi.myust LIKE '%qa%' OR usi.myust LIKE '%checker%' OR usi.myust LIKE '%QA%')
        ${searchWhere}
    `;

    params.push(limit, offset);
    const countParams = params.slice(0, -2);

    const [auditors, countResult] = await Promise.all([
      AppDataSource.query(query, params),
      AppDataSource.query(countQuery, countParams),
    ]);

    // Step 2: SQLite - get session statuses for all relevant CHPI codes
    const allChpiCodes = auditors
      .filter((a: any) => a.chpi_codes)
      .flatMap((a: any) => (a.chpi_codes as string).split(','));

    let statusMap = new Map<string, string>();
    if (allChpiCodes.length > 0) {
      const placeholders = allChpiCodes.map(() => '?').join(',');
      const statusRows: any[] = await localQuery(
        `SELECT chpi_code, status FROM audit_session_status WHERE chpi_code IN (${placeholders})`,
        allChpiCodes
      );
      for (const row of statusRows) {
        statusMap.set(row.chpi_code, row.status);
      }
    }

    // Step 3: Merge - compute assignment counts in JS
    const data = auditors.map((auditor: any) => {
      const codes = auditor.chpi_codes ? (auditor.chpi_codes as string).split(',') : [];
      let total_assignments = codes.length;
      let active_assignments = 0;
      let completed_assignments = 0;
      for (const code of codes) {
        const st = statusMap.get(code);
        if (st === 'IN_PROGRESS') active_assignments++;
        if (st === 'COMPLETED') completed_assignments++;
      }
      const { chpi_codes, ...rest } = auditor;
      return { ...rest, total_assignments, active_assignments, completed_assignments };
    });

    return { data, total: countResult[0]?.total || 0 };
  }

  /**
   * Manual assign auditor to process
   */
  async assignAuditor(chpiCode: string, auditorCode: string) {
    // Verify process exists
    const processRows = await AppDataSource.query(
      'SELECT code FROM bp_chpi_checkprocessitem WHERE code = ?',
      [chpiCode]
    );
    if (!processRows.length) throw new AppError('Audit process not found', 404);

    // Verify auditor exists and is active
    const auditorRows = await AppDataSource.query(
      'SELECT code, fullname FROM bp_usi_useritem WHERE code = ? AND active = 1',
      [auditorCode]
    );
    if (!auditorRows.length) throw new AppError('Auditor not found or inactive', 404);

    // Update CHPI checker
    await AppDataSource.query(
      'UPDATE bp_chpi_checkprocessitem SET mychecker = ?, updated_at = NOW() WHERE code = ?',
      [auditorCode, chpiCode]
    );

    // Update audit session status (SQLite)
    await localQuery(
      `UPDATE audit_session_status SET status = 'ASSIGNED', assigned_at = datetime('now'), updated_at = datetime('now')
       WHERE chpi_code = ? AND status = 'PENDING'`,
      [chpiCode]
    );

    // Update CHSI checker references
    await AppDataSource.query(
      'UPDATE bp_chsi_checkstepitem SET mychri = ?, updated_at = NOW() WHERE mychpi = ?',
      [auditorCode, chpiCode]
    );

    return {
      chpiCode,
      auditorCode,
      auditorName: auditorRows[0].fullname,
      status: 'ASSIGNED',
    };
  }

  /**
   * Random workload-based round-robin assignment
   */
  async randomAssign(chpiCode: string) {
    // Verify process exists
    const processRows = await AppDataSource.query(
      'SELECT code FROM bp_chpi_checkprocessitem WHERE code = ?',
      [chpiCode]
    );
    if (!processRows.length) throw new AppError('Audit process not found', 404);

    // Step 1: MySQL - get all auditors with their CHPI codes
    const auditorRows = await AppDataSource.query(
      `SELECT
        usi.code, usi.fullname,
        GROUP_CONCAT(DISTINCT chpi.code) as chpi_codes
       FROM bp_usi_useritem usi
       LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mychecker = usi.code
       WHERE usi.active = 1
         AND (usi.myust LIKE '%qa%' OR usi.myust LIKE '%checker%' OR usi.myust LIKE '%QA%')
       GROUP BY usi.code, usi.fullname`
    );

    // Step 2: SQLite - get active session statuses
    const allChpiCodes = auditorRows
      .filter((a: any) => a.chpi_codes)
      .flatMap((a: any) => (a.chpi_codes as string).split(','));

    let activeChpiSet = new Set<string>();
    if (allChpiCodes.length > 0) {
      const placeholders = allChpiCodes.map(() => '?').join(',');
      const activeRows: any[] = await localQuery(
        `SELECT chpi_code FROM audit_session_status WHERE chpi_code IN (${placeholders}) AND status IN ('ASSIGNED', 'IN_PROGRESS')`,
        allChpiCodes
      );
      activeChpiSet = new Set(activeRows.map((r: any) => r.chpi_code));
    }

    // Step 3: Calculate active count per auditor, sort by least active, pick random from ties
    const auditorsWithCount = auditorRows.map((a: any) => {
      const codes = a.chpi_codes ? (a.chpi_codes as string).split(',') : [];
      const active_count = codes.filter((c: string) => activeChpiSet.has(c)).length;
      return { code: a.code, fullname: a.fullname, active_count };
    });
    auditorsWithCount.sort((a: any, b: any) => a.active_count - b.active_count);

    // Pick random among those with the lowest active_count
    const minCount = auditorsWithCount[0]?.active_count ?? 0;
    const candidates = auditorsWithCount.filter((a: any) => a.active_count === minCount);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    const finalAuditorRows = selected ? [selected] : [];

    if (!finalAuditorRows.length) throw new AppError('No available auditors found', 404);

    const selectedAuditor = finalAuditorRows[0];

    // Assign the selected auditor
    return this.assignAuditor(chpiCode, selectedAuditor.code);
  }

  /**
   * Get auditor performance stats
   */
  async getAuditorPerformance(auditorCode: string) {
    // Step 1: MySQL - get CHPI codes for this auditor
    const chpiRows: any[] = await AppDataSource.query(
      'SELECT code FROM bp_chpi_checkprocessitem WHERE mychecker = ?',
      [auditorCode]
    );
    const chpiCodes = chpiRows.map((r: any) => r.code);

    if (!chpiCodes.length) {
      return {
        auditorCode,
        summary: { total_audits: 0, completed_audits: 0, in_progress_audits: 0, assigned_audits: 0,
                    avg_score_given: null, avg_completion_hours: null,
                    pass_results: 0, retrain_results: 0, terminate_results: 0 },
        byType: [],
      };
    }

    // Step 2: SQLite - get session statuses for those CHPI codes
    const placeholders = chpiCodes.map(() => '?').join(',');
    const sessions: any[] = await localQuery(
      `SELECT chpi_code, audit_type, status, total_score, threshold_result, assigned_at, completed_at
       FROM audit_session_status WHERE chpi_code IN (${placeholders})`,
      chpiCodes
    );

    // Step 3: Compute stats in JS
    let total_audits = sessions.length;
    let completed_audits = 0, in_progress_audits = 0, assigned_audits = 0;
    let pass_results = 0, retrain_results = 0, terminate_results = 0;
    let scoreSum = 0, scoreCount = 0;
    let hoursSum = 0, hoursCount = 0;

    const typeMap = new Map<string, { count: number; scoreSum: number; scoreCount: number }>();

    for (const s of sessions) {
      if (s.status === 'COMPLETED') completed_audits++;
      if (s.status === 'IN_PROGRESS') in_progress_audits++;
      if (s.status === 'ASSIGNED') assigned_audits++;
      if (s.threshold_result === 'PASS') pass_results++;
      if (s.threshold_result === 'RETRAIN') retrain_results++;
      if (s.threshold_result === 'TERMINATE') terminate_results++;
      if (s.total_score != null) { scoreSum += Number(s.total_score); scoreCount++; }
      if (s.assigned_at && s.completed_at) {
        const hours = (new Date(s.completed_at).getTime() - new Date(s.assigned_at).getTime()) / 3600000;
        hoursSum += hours; hoursCount++;
      }
      // by type
      if (!typeMap.has(s.audit_type)) typeMap.set(s.audit_type, { count: 0, scoreSum: 0, scoreCount: 0 });
      const t = typeMap.get(s.audit_type)!;
      t.count++;
      if (s.total_score != null) { t.scoreSum += Number(s.total_score); t.scoreCount++; }
    }

    const summary = {
      total_audits,
      completed_audits,
      in_progress_audits,
      assigned_audits,
      avg_score_given: scoreCount > 0 ? scoreSum / scoreCount : null,
      avg_completion_hours: hoursCount > 0 ? hoursSum / hoursCount : null,
      pass_results,
      retrain_results,
      terminate_results,
    };

    const byType = Array.from(typeMap.entries()).map(([audit_type, t]) => ({
      audit_type,
      count: t.count,
      avg_score: t.scoreCount > 0 ? t.scoreSum / t.scoreCount : null,
    }));

    return { auditorCode, summary, byType };
  }
}
