import { AppDataSource } from '../../config/database';
import { buildPaginationMeta } from '../../common/utils/pagination';
import { AuditProcessService } from '../audit-process/audit-process.service';

export class AuditorAssignmentService {
  async listAuditors(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT
        u.code AS usi_code,
        u.fullname AS auditor_name,
        COUNT(DISTINCT chpi.code) AS workload
      FROM bp_usi_useritem u
      INNER JOIN bp_usid_usiduty d ON d.myusi = u.code AND d.myust IN ('QA', 'TO')
      LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mychecker = u.code
      WHERE u.active = 1
      GROUP BY u.code, u.fullname
      ORDER BY u.fullname ASC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(DISTINCT u.code) AS total
      FROM bp_usi_useritem u
      INNER JOIN bp_usid_usiduty d ON d.myusi = u.code AND d.myust IN ('QA', 'TO')
      WHERE u.active = 1
    `;

    const data = await AppDataSource.query(dataSql, [limit, offset]);
    const countResult = await AppDataSource.query(countSql);
    const total = Number(countResult[0]?.total || 0);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async assignAuditor(chpiCode: string, auditorUsiCode: string) {
    // 1. Verify CHPI exists
    const chpiRows = await AppDataSource.query(
      'SELECT code, mychecker, status FROM bp_chpi_checkprocessitem WHERE code = ?',
      [chpiCode],
    );
    if (!chpiRows || chpiRows.length === 0) {
      throw { statusCode: 404, message: 'Audit process not found' };
    }

    // 2. Reject if Audited
    if (chpiRows[0].status === 'Audited') {
      throw { statusCode: 400, message: 'Cannot assign to an audited session' };
    }

    // 3. Verify auditor exists (USI with QA/TO duty)
    const auditorRows = await AppDataSource.query(
      `SELECT u.code, u.fullname FROM bp_usi_useritem u
       INNER JOIN bp_usid_usiduty d ON d.myusi = u.code AND d.myust IN ('QA', 'TO')
       WHERE u.code = ? AND u.active = 1 LIMIT 1`,
      [auditorUsiCode],
    );
    if (!auditorRows || auditorRows.length === 0) {
      throw { statusCode: 404, message: 'Auditor not found' };
    }

    // 4. UPDATE CHPI
    await AppDataSource.query(
      "UPDATE bp_chpi_checkprocessitem SET mychecker = ?, status = 'Assigned', updated_at = NOW() WHERE code = ?",
      [auditorUsiCode, chpiCode],
    );

    // 5. UPDATE CHSI
    await AppDataSource.query(
      "UPDATE bp_chsi_checkstepitem SET mychri = ?, status = 'Assigned', updated_at = NOW() WHERE mychpi = ?",
      [auditorUsiCode, chpiCode],
    );

    // 6. UPDATE CHLI
    await AppDataSource.query(
      `UPDATE bp_chli_checklistitem SET status = 'Assigned'
       WHERE mychsi IN (SELECT code FROM bp_chsi_checkstepitem WHERE mychpi = ?)`,
      [chpiCode],
    );

    return {
      chpi_code: chpiCode,
      auditor_usi_code: auditorUsiCode,
      auditor_name: auditorRows[0].fullname,
      status: 'Assigned',
    };
  }

  async randomAssign(chpiCodes: string[]) {
    // 1. Fetch all auditors (QA/TO) with workload
    const auditorSql = `
      SELECT
        u.code AS usi_code,
        u.fullname AS auditor_name,
        COUNT(DISTINCT chpi.code) AS workload
      FROM bp_usi_useritem u
      INNER JOIN bp_usid_usiduty d ON d.myusi = u.code AND d.myust IN ('QA', 'TO')
      LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mychecker = u.code
      WHERE u.active = 1
      GROUP BY u.code, u.fullname
      ORDER BY workload ASC, u.code ASC
    `;
    const auditors = await AppDataSource.query(auditorSql);
    if (!auditors.length) {
      throw { statusCode: 400, message: 'No auditors available' };
    }

    // 2. Build workload map
    const workloadMap = new Map<string, { auditor_name: string; workload: number }>();
    for (const a of auditors) {
      workloadMap.set(a.usi_code, { auditor_name: a.auditor_name, workload: Number(a.workload) });
    }

    const assigned: Array<{ chpi_code: string; auditor_usi_code: string; auditor_name: string }> = [];
    const skipped: Array<{ chpi_code: string; reason: string }> = [];

    // 3. Batch fetch CHPI for all codes
    const chpiPlaceholders = chpiCodes.map(() => '?').join(',');
    const batchChpiRows = await AppDataSource.query(
      `SELECT code, mychecker, status FROM bp_chpi_checkprocessitem WHERE code IN (${chpiPlaceholders})`,
      chpiCodes,
    );

    const chpiBatchMap = new Map<string, any>();
    for (const row of batchChpiRows) {
      chpiBatchMap.set(row.code, row);
    }

    // 4. For each chpi_code, validate and assign round-robin
    for (const chpiCode of chpiCodes) {
      const chpiData = chpiBatchMap.get(chpiCode);
      if (!chpiData) {
        skipped.push({ chpi_code: chpiCode, reason: 'Not found' });
        continue;
      }
      if (chpiData.mychecker) {
        skipped.push({ chpi_code: chpiCode, reason: 'Already assigned' });
        continue;
      }
      if (chpiData.status === 'Audited') {
        skipped.push({ chpi_code: chpiCode, reason: 'Audited' });
        continue;
      }

      // Pick auditor with lowest workload
      let bestCode = '';
      let bestWl = Infinity;
      for (const [code, info] of workloadMap) {
        if (info.workload < bestWl || (info.workload === bestWl && code < bestCode)) {
          bestCode = code;
          bestWl = info.workload;
        }
      }

      // UPDATE CHPI + CHSI + CHLI
      await AppDataSource.query(
        "UPDATE bp_chpi_checkprocessitem SET mychecker = ?, status = 'Assigned', updated_at = NOW() WHERE code = ?",
        [bestCode, chpiCode],
      );
      await AppDataSource.query(
        "UPDATE bp_chsi_checkstepitem SET mychri = ?, status = 'Assigned', updated_at = NOW() WHERE mychpi = ?",
        [bestCode, chpiCode],
      );
      await AppDataSource.query(
        `UPDATE bp_chli_checklistitem SET status = 'Assigned'
         WHERE mychsi IN (SELECT code FROM bp_chsi_checkstepitem WHERE mychpi = ?)`,
        [chpiCode],
      );

      const auditorInfo = workloadMap.get(bestCode)!;
      auditorInfo.workload++;
      assigned.push({
        chpi_code: chpiCode,
        auditor_usi_code: bestCode,
        auditor_name: auditorInfo.auditor_name,
      });
    }

    return { assigned, skipped };
  }

  async searchAuditors(query: string, limit: number = 10) {
    const like = `%${query}%`;
    const sql = `
      SELECT u.code AS usi_code, u.fullname,
             COUNT(DISTINCT chpi.code) AS workload
      FROM bp_usi_useritem u
      INNER JOIN bp_usid_usiduty d ON d.myusi = u.code AND d.myust IN ('QA', 'TO')
      LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mychecker = u.code
      WHERE (u.fullname LIKE ? OR u.code LIKE ?)
        AND u.active = 1
      GROUP BY u.code, u.fullname
      ORDER BY u.fullname ASC
      LIMIT ?
    `;
    const rows = await AppDataSource.query(sql, [like, like, limit]);
    return rows.map((r: any) => ({
      usi_code: r.usi_code,
      auditor_name: r.fullname,
      workload: Number(r.workload),
    }));
  }

  async unassignAuditor(chpiCode: string) {
    // 1. Verify CHPI exists + has mychecker
    const chpiRows = await AppDataSource.query(
      'SELECT code, mychecker, mytrigger, status FROM bp_chpi_checkprocessitem WHERE code = ?',
      [chpiCode],
    );
    if (!chpiRows || chpiRows.length === 0) {
      throw { statusCode: 404, message: 'Audit process not found' };
    }
    if (!chpiRows[0].mychecker) {
      throw { statusCode: 400, message: 'No auditor assigned to this audit process' };
    }

    // 2. Reject if status Auditing or Audited
    const chpiStatus = chpiRows[0].status;
    if (chpiStatus === 'Auditing' || chpiStatus === 'Audited') {
      throw { statusCode: 400, message: `Cannot unassign: audit is ${chpiStatus}` };
    }

    // 3. UPDATE CHPI — clear mychecker and set status to Open
    await AppDataSource.query(
      "UPDATE bp_chpi_checkprocessitem SET mychecker = NULL, status = 'Open', updated_at = NOW() WHERE code = ?",
      [chpiCode],
    );

    // 4. UPDATE CHSI — clear mychri and set status to Open
    await AppDataSource.query(
      "UPDATE bp_chsi_checkstepitem SET mychri = NULL, status = 'Open', updated_at = NOW() WHERE mychpi = ?",
      [chpiCode],
    );

    // 5. UPDATE CHLI — set status to Open
    await AppDataSource.query(
      `UPDATE bp_chli_checklistitem SET status = 'Open'
       WHERE mychsi IN (SELECT code FROM bp_chsi_checkstepitem WHERE mychpi = ?)`,
      [chpiCode],
    );

    return { chpi_code: chpiCode, status: 'Open' };
  }

  async assignOnboard(usiCode: string, auditorUsiCode: string, cuieCode: string) {
    // 1. Check if CHPI already exists for this USI + ONBOARDAUDIT
    const existingChpi = await AppDataSource.query(
      "SELECT code FROM bp_chpi_checkprocessitem WHERE mytrigger = ? AND mychpttype = 'ONB-AUDIT'",
      [usiCode],
    );

    if (existingChpi && existingChpi.length > 0) {
      // CHPI exists — just update assignment
      const chpiCode = existingChpi[0].code;
      await AppDataSource.query(
        "UPDATE bp_chpi_checkprocessitem SET mychecker = ?, status = 'Assigned', updated_at = NOW() WHERE code = ?",
        [auditorUsiCode, chpiCode],
      );
      await AppDataSource.query(
        "UPDATE bp_chsi_checkstepitem SET mychri = ?, status = 'Assigned', updated_at = NOW() WHERE mychpi = ?",
        [auditorUsiCode, chpiCode],
      );
      await AppDataSource.query(
        `UPDATE bp_chli_checklistitem SET status = 'Assigned'
         WHERE mychsi IN (SELECT code FROM bp_chsi_checkstepitem WHERE mychpi = ?)`,
        [chpiCode],
      );
      return { chpi_code: chpiCode, auditor_usi_code: auditorUsiCode, status: 'Assigned' };
    }

    // 2. Create new CHPI/CHSI/CHLI
    const auditProcessService = new AuditProcessService();
    const result = await auditProcessService.createOnboardAudit(cuieCode, usiCode, auditorUsiCode);
    return { chpi_code: result.chpi_code, auditor_usi_code: auditorUsiCode, status: 'Assigned' };
  }

  async getPerformance(auditorCode: string) {
    // 1. Get all CHPI records assigned to this auditor with status
    const chpiRows = await AppDataSource.query(
      'SELECT code, status FROM bp_chpi_checkprocessitem WHERE mychecker = ?',
      [auditorCode],
    );

    if (!chpiRows || chpiRows.length === 0) {
      return {
        stats: { total_audits: 0, completed: 0, avg_score: 0, pass_count: 0, retrain_count: 0, terminate_count: 0 },
        audits: [],
      };
    }

    // 2. Aggregate stats from MySQL status
    let completed = 0;
    const audits: any[] = [];

    for (const chpi of chpiRows) {
      const audit: any = {
        code: chpi.code,
        status: chpi.status || 'UNKNOWN',
      };
      audits.push(audit);
      if (chpi.status === 'Audited') completed++;
    }

    return {
      stats: {
        total_audits: chpiRows.length,
        completed,
        avg_score: 0,
        pass_count: 0,
        retrain_count: 0,
        terminate_count: 0,
      },
      audits,
    };
  }
}
