import { AppDataSource } from '../../config/database';
import { buildPaginationMeta } from '../../common/utils/pagination';
import {
  generateAuditProcessCode,
  generateAuditStepCode,
  generateChecklistCode,
} from '../../common/utils/code-generator';
import { CreateAuditProcessInput } from './audit-process.schema';

export class AuditProcessService {
  async list(page: number, limit: number, filters: {
    auditType?: string; status?: string; search?: string; auditor?: string;
    dateFrom?: string; dateTo?: string; userCode?: string; userRole?: string;
    pt?: string; gg?: string;
  }) {
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filters.auditType) {
      const types = filters.auditType.split(',').map(s => s.trim());
      conditions.push(`chpi.mychpttype IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
    if (filters.status) {
      const statuses = filters.status.split(',').map(s => s.trim());
      conditions.push(`chpi.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (filters.search) {
      conditions.push('(gv.fullname LIKE ? OR gv.code LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.auditor) {
      conditions.push('(aud.fullname LIKE ? OR aud.code LIKE ?)');
      params.push(`%${filters.auditor}%`, `%${filters.auditor}%`);
    }
    if (filters.dateFrom) {
      conditions.push('chpi.created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push('chpi.created_at <= ?');
      params.push(filters.dateTo + ' 23:59:59');
    }
    if (filters.pt) {
      const pts = filters.pt.split(',').map(s => s.trim());
      conditions.push(`ulc.mypt IN (${pts.map(() => '?').join(',')})`);
      params.push(...pts);
    }
    if (filters.gg) {
      const ggs = filters.gg.split(',').map(s => s.trim());
      conditions.push(`ulc.mygg IN (${ggs.map(() => '?').join(',')})`);
      params.push(...ggs);
    }
    if (filters.userRole === 'QA' && filters.userCode) {
      conditions.push('chpi.mychecker = ?');
      params.push(filters.userCode);
    }

    const whereClause = conditions.join(' AND ');

    const joinClause = `
      FROM bp_chpi_checkprocessitem chpi
      LEFT JOIN bp_usi_useritem gv ON gv.code = chpi.mytrigger
      LEFT JOIN bp_usi_useritem aud ON aud.code = chpi.mychecker
      LEFT JOIN bp_ulc_uniquelearningcomponent ulc ON ulc.code = chpi.myulc
      LEFT JOIN bp_cap_calendarperiod cap ON cap.code = ulc.mycap`;

    const dataSql = `
      SELECT chpi.code, chpi.name, chpi.mychpttype, chpi.mytrigger, chpi.mychecker,
             chpi.status, chpi.created_at, chpi.myulc,
             gv.fullname AS gv_name,
             ulc.mypt, ulc.mygg, ulc.mylcp, cap.startperiod AS capstart
      ${joinClause}
      WHERE ${whereClause}
      ORDER BY chpi.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, data] = await Promise.all([
      AppDataSource.query(`SELECT COUNT(*) as cnt ${joinClause} WHERE ${whereClause}`, params),
      AppDataSource.query(dataSql, [...params, limit, offset]),
    ]);
    const total = Number(countResult[0]?.cnt || 0);

    const merged = data.map((row: any) => ({
      code: row.code,
      name: row.name,
      audit_type: row.mychpttype,
      usi_code: row.mytrigger,
      gv_name: row.gv_name,
      auditor_code: row.mychecker,
      mypt: row.mypt,
      mygg: row.mygg,
      mylcp: row.mylcp,
      capstart: row.capstart,
      myulc: row.myulc,
      status: row.status,
      created_at: row.created_at,
    }));

    return { data: merged, meta: buildPaginationMeta(total, page, limit) };
  }

  async getFilterOptions() {
    const [ptRows, ggRows, teacherRows, auditorRows] = await Promise.all([
      AppDataSource.query(`SELECT code, name FROM bp_pt_producttype WHERE published + 0 = 1 ORDER BY code`),
      AppDataSource.query(`SELECT code, name FROM bp_gg_gradegroup WHERE published + 0 = 1
        ORDER BY LEFT(code, 1) DESC, CAST(SUBSTRING(code, 2) AS UNSIGNED) ASC`),
      AppDataSource.query(`SELECT DISTINCT gv.code, gv.fullname
        FROM bp_chpi_checkprocessitem chpi
        INNER JOIN bp_usi_useritem gv ON gv.code = chpi.mytrigger
        ORDER BY gv.fullname`),
      AppDataSource.query(`SELECT DISTINCT aud.code, aud.fullname
        FROM bp_chpi_checkprocessitem chpi
        INNER JOIN bp_usi_useritem aud ON aud.code = chpi.mychecker
        ORDER BY aud.fullname`),
    ]);
    return {
      pt: ptRows.map((r: any) => ({ code: r.code, name: r.name })),
      gg: ggRows.map((r: any) => ({ code: r.code, name: r.name })),
      teachers: teacherRows.map((r: any) => ({ code: r.code, fullname: r.fullname })),
      auditors: auditorRows.map((r: any) => ({ code: r.code, fullname: r.fullname })),
    };
  }

  async createAuditProcess(input: CreateAuditProcessInput) {
    const { cuie_code, audit_type, trigger_usi_code } = input;

    // 1. Resolve PT+GG+LCP + ULC/CLAG from cuie_code via bp_cuie_details
    const ptRows = await AppDataSource.query(
      `SELECT mypt, mygg, mylcp, mylct, myulc FROM staging_s2_parent_report_db.bp_cuie_details WHERE mycuie = ? LIMIT 1`,
      [cuie_code]
    );
    if (!ptRows || ptRows.length === 0) {
      throw { statusCode: 400, message: 'Cannot resolve PT-GG-LCP for this CUIE event' };
    }
    const { mypt, mygg, mylcp, mylct } = ptRows[0];

    // 2. Find CHPT by mypt + mygg + mylcp
    const chptRows = await AppDataSource.query(
      'SELECT code, name, mylcet FROM bp_chpt_checkprocesstemp WHERE mypt = ? AND mygg = ? AND mylcp = ? AND published + 0 = 1 LIMIT 1',
      [mypt, mygg, mylcp]
    );
    if (!chptRows || chptRows.length === 0) {
      throw { statusCode: 400, message: `No audit template for PT=${mypt}, GG=${mygg}, LCP=${mylcp}. Contact admin to create template.` };
    }
    const chpt = chptRows[0];

    // 3. Check duplicate
    const dupRows = await AppDataSource.query(
      'SELECT code FROM bp_chpi_checkprocessitem WHERE description = ? AND mychpttype = ?',
      [cuie_code, audit_type]
    );
    if (dupRows && dupRows.length > 0) {
      throw { statusCode: 409, message: 'Audit process already exists for this CUIE and audit type' };
    }

    // 4. Resolve CLAG + CTI video data
    const { mycti1, mycti2, resolvedClag } = await this.resolveCtiData(
      ptRows[0].myulc, trigger_usi_code,
    );

    // 5. Generate CHPI code and INSERT
    const chpiCode = generateAuditProcessCode(
      ptRows[0].myulc, audit_type, trigger_usi_code,
    );
    const chpiName = `${chpt.name} | ${mylct || ''}`;
    await AppDataSource.query(
      `INSERT INTO bp_chpi_checkprocessitem
         (code, name, description, mychpt, mychpttype, mylcet, mycuievent, mytrigger, mycti1, mycti2, myulc, myclag, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 'Open', NOW())`,
      [chpiCode, chpiName, cuie_code, chpt.code, audit_type, chpt.mylcet, trigger_usi_code, mycti1, mycti2, ptRows[0].myulc || null, resolvedClag || null]
    );

    // 6. Create CHSI + CHLI from templates
    const result = await this.createStepsAndChecklists(chpiCode, chpt.code, undefined, undefined, ptRows[0].myulc, trigger_usi_code, audit_type);

    return { chpi_code: chpiCode, chsi_count: result.chsiCount, chli_count: result.chliCount };
  }

  async createOnboardAudit(cuieCode: string, usiCode: string, auditorUsiCode: string) {
    // 1. Resolve PT+GG+LCP + session info from cuie_code
    const detailRows = await AppDataSource.query(
      `SELECT mypt, mygg, mylcp, mylct, myulc, myparentush, cap_startperiod
       FROM staging_s2_parent_report_db.bp_cuie_details WHERE mycuie = ? LIMIT 1`,
      [cuieCode]
    );
    if (!detailRows || detailRows.length === 0) {
      throw { statusCode: 400, message: 'Cannot resolve session details for this CUIE event' };
    }
    const { mypt, mygg, mylcp, mylct, myulc, myparentush, cap_startperiod } = detailRows[0];

    // 2. Find CHPT by mypt + mygg + mylcp
    const chptRows = await AppDataSource.query(
      'SELECT code, name, mylcet FROM bp_chpt_checkprocesstemp WHERE mypt = ? AND mygg = ? AND mylcp = ? AND published + 0 = 1 LIMIT 1',
      [mypt, mygg, mylcp]
    );
    if (!chptRows || chptRows.length === 0) {
      throw { statusCode: 400, message: `No audit template for PT=${mypt}, GG=${mygg}, LCP=${mylcp}. Contact admin to create template.` };
    }
    const chpt = chptRows[0];

    // 3. Resolve CLAG + CTI video data
    const { mycti1, mycti2, resolvedClag } = await this.resolveCtiData(
      myulc, usiCode,
    );

    // 4. Generate CHPI code and INSERT
    const chpiCode = generateAuditProcessCode(
      myulc, 'ONB-AUDIT', usiCode,
    );
    const chpiName = `${chpt.name} | ${mylct || ''}`;
    await AppDataSource.query(
      `INSERT INTO bp_chpi_checkprocessitem
         (code, name, description, mychpt, mychpttype, mylcet, mycuievent, mytrigger, mychecker, mycti1, mycti2, myulc, myclag, status, created_at)
       VALUES (?, ?, ?, ?, 'ONB-AUDIT', ?, NULL, ?, ?, ?, ?, ?, ?, 'Assigned', NOW())`,
      [chpiCode, chpiName, cuieCode, chpt.code, chpt.mylcet, usiCode, auditorUsiCode, mycti1, mycti2, myulc || null, resolvedClag || null]
    );

    // 5. Create CHSI + CHLI from templates with status = 'Assigned'
    const result = await this.createStepsAndChecklists(chpiCode, chpt.code, auditorUsiCode, 'Assigned', myulc, usiCode, 'ONB-AUDIT');

    return { chpi_code: chpiCode, chsi_count: result.chsiCount, chli_count: result.chliCount };
  }

  /**
   * Resolve CLAG code, slide link (SSTE), and video links (VCR) for a CUIE event.
   * mycti1 = Slide Teacher link (CTI_SSTE) from bp_cti_contentitem.myvalueset
   * mycti2 = JSON array of all video URLs from bp_usi_vcr_meeting + bp_vcr_meeting
   * CLAG = from bp_usi_vcr_meeting.clag_code (by teacher + ULC + published)
   */
  private async resolveCtiData(
    myulc: string | null,
    teacherCode: string,
  ): Promise<{ mycti1: string | null; mycti2: string | null; resolvedClag: string | null }> {
    let resolvedClag: string | null = null;
    let mycti1: string | null = null;
    let mycti2: string | null = null;

    // 1. Resolve CLAG from bp_usi_vcr_meeting (direct, by teacher + ULC + published)
    if (myulc && teacherCode) {
      const clagRows = await AppDataSource.query(
        `SELECT clag_code FROM bp_usi_vcr_meeting
         WHERE myulc = ? AND myusi = ? AND published + 0 = 1 AND clag_code IS NOT NULL
         LIMIT 1`,
        [myulc, teacherCode]
      );
      resolvedClag = clagRows[0]?.clag_code || null;
    }

    // 2. mycti1: Slide Teacher (SSTE) via bp_cui_content_user_ulc_instance → bp_cti_contentitem
    if (myulc && teacherCode) {
      const ssteRows = await AppDataSource.query(
        `SELECT cti.myvalueset
         FROM bp_cui_content_user_ulc_instance cui
         JOIN bp_cti_contentitem cti ON cui.mycti = cti.myparentcti
         WHERE cui.myusi = ? AND cui.myulc = ? AND cti.myctt = 'CTI_SSTE'
         LIMIT 1`,
        [teacherCode, myulc]
      );
      mycti1 = ssteRows[0]?.myvalueset || null;
    }

    // 3. mycti2: All video links from VCR (bp_usi_vcr_meeting + bp_vcr_meeting)
    if (myulc && teacherCode) {
      const vcrRows = await AppDataSource.query(
        `SELECT COALESCE(
            IF(vcr.code LIKE '%-%', vcr.view_url, cti.starturl),
            vcr.view_url
         ) AS view_url
         FROM bp_usi_vcr_meeting uvm
         JOIN bp_ulc_uniquelearningcomponent ulc ON uvm.myulc = ulc.code
         JOIN bp_cap_calendarperiod cap ON ulc.mycap = cap.code
         JOIN bp_vcr_meeting vcr ON vcr.code = uvm.myvcr
         LEFT JOIN bp_cti_contentitem cti
             ON vcr.code NOT LIKE '%-%'
            AND DATE(vcr.start_time) = DATE(cti.created_at)
            AND vcr.clag_code = cti.secretkey
         WHERE uvm.myusi = ? AND uvm.myulc = ?
         ORDER BY DATE(cap.startperiod) DESC`,
        [teacherCode, myulc]
      );
      const urls = (vcrRows || [])
        .map((r: any) => r.view_url)
        .filter((u: string | null) => u != null && u !== '');
      if (urls.length > 0) {
        mycti2 = JSON.stringify(urls);
      }
    }

    return { mycti1, mycti2, resolvedClag };
  }

  private async createStepsAndChecklists(
    chpiCode: string,
    chptCode: string,
    auditorCode?: string,
    status?: string,
    myulc?: string,
    triggerCode?: string,
    auditType?: string,
  ) {
    const chstRows = await AppDataSource.query(
      'SELECT code, name, checksample FROM bp_chst_checksteptemp WHERE mychpt = ? AND published + 0 = 1',
      [chptCode]
    );
    chstRows.sort((a: any, b: any) => {
      const numA = parseInt((a.name || '').replace(/^Page\s+/, ''), 10) || 0;
      const numB = parseInt((b.name || '').replace(/^Page\s+/, ''), 10) || 0;
      return numA - numB;
    });

    let chsiCount = 0;
    let chliCount = 0;

    for (let si = 0; si < chstRows.length; si++) {
      const chst = chstRows[si];
      const chsiCode = generateAuditStepCode(chst.code, si + 1);

      await AppDataSource.query(
        `INSERT INTO bp_chsi_checkstepitem
           (code, name, checksample, mychpi, mychri, mychst, myulc, mytrigger, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [chsiCode, chst.name, chst.checksample, chpiCode, auditorCode || null, chst.code, myulc || null, triggerCode || null, status || 'Open']
      );
      chsiCount++;

      const chltRows = await AppDataSource.query(
        `SELECT code, subcode, name, myparentchlt, scoretype, score1, scoretype2, score2,
                \`do\`, donot, correctexample, incorrectexample
         FROM bp_chlt_checklisttemp WHERE mychst = ? AND published + 0 = 1 ORDER BY code ASC`,
        [chst.code]
      );

      for (let ci = 0; ci < chltRows.length; ci++) {
        const chlt = chltRows[ci];
        const chliCode = generateChecklistCode(triggerCode || 'NA', auditType || 'NA', chst.code, si + 1, ci + 1);

        await AppDataSource.query(
          `INSERT INTO bp_chli_checklistitem
             (code, subcode, name, mychsi, myparentchlt, mysubchlt,
              \`do\`, donot, correctexample, incorrectexample,
              scoretype1, score1, scoretype2, score2, myulc, mytrigger, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [chliCode, chlt.subcode, chlt.name, chsiCode, chlt.myparentchlt, chlt.code,
           chlt.do, chlt.donot, chlt.correctexample, chlt.incorrectexample,
           chlt.scoretype, null, chlt.scoretype2, null, myulc || null, triggerCode || null, status || 'Open']
        );
        chliCount++;
      }
    }

    return { chsiCount, chliCount };
  }

  /**
   * Transition an audit process from PENDING → AUDITING.
   * Called when user clicks "Start Audit" on the onboard list page.
   */
  async startAudit(code: string): Promise<{ chpi_code: string }> {
    // 1. Verify CHPI exists
    const chpiRows = await AppDataSource.query(
      'SELECT code FROM bp_chpi_checkprocessitem WHERE code = ?',
      [code],
    );
    if (!chpiRows || chpiRows.length === 0) {
      throw { statusCode: 404, message: 'Audit process not found' };
    }

    // 2. Update audit_session_status: PENDING → AUDITING
    const result = await AppDataSource.query(
      `UPDATE audit_session_status
       SET status = 'AUDITING', started_at = NOW(), updated_at = NOW()
       WHERE chpi_code = ? AND status = 'PENDING'`,
      [code],
    );

    // Check if any row was actually updated
    if (result.affectedRows === 0) {
      throw { statusCode: 409, message: 'Audit is not in PENDING status or does not exist' };
    }

    return { chpi_code: code };
  }

  async getDetail(code: string) {
    // 1. Fetch CHPI
    const chpiRows = await AppDataSource.query(
      `SELECT code, name, description, mychpt, mychpttype, mytrigger, mychecker, mycti1, mycti2, myulc, myclag, status, created_at
       FROM bp_chpi_checkprocessitem WHERE code = ?`,
      [code]
    );
    if (!chpiRows || chpiRows.length === 0) {
      throw { statusCode: 404, message: 'Audit process not found' };
    }
    const chpi = chpiRows[0];

    // 2. Fetch GV (USI) info
    const usiRows = await AppDataSource.query(
      'SELECT code, fullname, email, myust FROM bp_usi_useritem WHERE code = ?',
      [chpi.mytrigger]
    );
    const gv = usiRows[0] || null;

    // 3. Fetch CUIE event info
    const cuieRef = chpi.description;
    let cuie = null;
    if (cuieRef) {
      const cuieRows = await AppDataSource.query(
        `SELECT mycuie AS code, mylcet_lceventtype, trigger_at, myusi
         FROM staging_s2_parent_report_db.bp_cuie_details WHERE mycuie = ? LIMIT 1`,
        [cuieRef]
      );
      cuie = cuieRows[0] || null;
    }

    // 4. Fetch CHSI steps
    const chsiRows = await AppDataSource.query(
      'SELECT code, name, checksample, mychpi, mychst, status FROM bp_chsi_checkstepitem WHERE mychpi = ?',
      [code]
    );

    chsiRows.sort((a: any, b: any) => {
      const numA = parseInt((a.name || '').replace(/^Page\s+/, ''), 10) || 0;
      const numB = parseInt((b.name || '').replace(/^Page\s+/, ''), 10) || 0;
      return numA - numB;
    });

    // 5. For each step, fetch CHLI items
    const steps = [];
    for (const chsi of chsiRows) {
      const chliRows = await AppDataSource.query(
        `SELECT code, name, mychsi, myparentchlt, scoretype1, score1, status, description
         FROM bp_chli_checklistitem WHERE mychsi = ? ORDER BY code ASC`,
        [chsi.code]
      );
      steps.push({ ...chsi, items: chliRows });
    }

    return {
      code: chpi.code,
      name: chpi.name,
      audit_type: chpi.mychpttype,
      mychpt: chpi.mychpt,
      mychecker: chpi.mychecker,
      mycti1: chpi.mycti1,
      mycti2: chpi.mycti2,
      myulc: chpi.myulc,
      myclag: chpi.myclag,
      status: chpi.status,
      created_at: chpi.created_at,
      gv,
      cuie,
      steps,
    };
  }

  async getHistory(page: number, limit: number, filters: {
    teacher?: string; auditor?: string; fromDate?: string; toDate?: string; pt?: string; gg?: string;
  }) {
    const offset = (page - 1) * limit;

    // Build filter conditions
    const conditions: string[] = ["chpi.status = 'Audited'"];
    const filterParams: any[] = [];

    if (filters.teacher) {
      conditions.push('(gv.fullname LIKE ? OR gv.code LIKE ?)');
      filterParams.push(`%${filters.teacher}%`, `%${filters.teacher}%`);
    }
    if (filters.auditor) {
      conditions.push('(aud.fullname LIKE ? OR aud.code LIKE ?)');
      filterParams.push(`%${filters.auditor}%`, `%${filters.auditor}%`);
    }
    if (filters.pt) {
      conditions.push('chpt.mypt = ?');
      filterParams.push(filters.pt);
    }
    if (filters.gg) {
      conditions.push('chpt.mygg = ?');
      filterParams.push(filters.gg);
    }
    if (filters.fromDate) {
      conditions.push('chpi.created_at >= ?');
      filterParams.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push('chpi.created_at <= ?');
      filterParams.push(filters.toDate);
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*) AS cnt
      FROM bp_chpi_checkprocessitem chpi
      LEFT JOIN bp_usi_useritem gv ON gv.code = chpi.mytrigger
      LEFT JOIN bp_usi_useritem aud ON aud.code = chpi.mychecker
      LEFT JOIN bp_chpt_checkprocesstemp chpt ON chpt.code = chpi.mychpt
      WHERE ${whereClause}
    `;
    const countResult = await AppDataSource.query(countSql, filterParams);
    const total = Number(countResult[0]?.cnt || 0);

    if (total === 0) {
      return { data: [], meta: buildPaginationMeta(0, page, limit) };
    }

    const dataSql = `
      SELECT chpi.code, chpi.name, chpi.mychpttype AS audit_type,
             gv.fullname AS teacher_name, aud.fullname AS auditor_name,
             chpi.status, chpi.created_at
      FROM bp_chpi_checkprocessitem chpi
      LEFT JOIN bp_usi_useritem gv ON gv.code = chpi.mytrigger
      LEFT JOIN bp_usi_useritem aud ON aud.code = chpi.mychecker
      LEFT JOIN bp_chpt_checkprocesstemp chpt ON chpt.code = chpi.mychpt
      WHERE ${whereClause}
      ORDER BY chpi.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const data = await AppDataSource.query(dataSql, [...filterParams, limit, offset]);

    return {
      data: data.map((row: any) => ({
        code: row.code,
        audit_type: row.audit_type,
        teacher_name: row.teacher_name,
        auditor_name: row.auditor_name,
        status: row.status,
        created_at: row.created_at,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
