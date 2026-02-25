import { AppDataSource } from '../../config/database';
import { buildPaginationMeta } from '../../common/utils/pagination';

export class GvFilterService {
  async getCurrentPeriods() {
    const weekRows = await AppDataSource.query(
      "SELECT code, startperiod, endperiod FROM bp_cap_calendarperiod WHERE startperiod <= NOW() AND endperiod >= NOW() AND captype = 'CAWK' LIMIT 1",
    );
    const monthRows = await AppDataSource.query(
      "SELECT code, startperiod, endperiod FROM bp_cap_calendarperiod WHERE startperiod <= NOW() AND endperiod >= NOW() AND captype = 'CAMN' LIMIT 1",
    );
    return {
      week: weekRows[0] || null,
      month: monthRows[0] || null,
    };
  }

  // Only show events with mylck that have matching CHPT audit templates
  static readonly VALID_LCK = ['GE', 'LI', 'DL'];

  /**
   * Refactored: reads pre-created CHPI + JOIN ULC/CAP for PT/GG/LCP/capstart.
   * No cross-database query to cuie_details.
   */
  async filterOnboard(page: number, limit: number, filters: {
    pt?: string; gg?: string; status?: string; search?: string;
    auditor?: string; dateFrom?: string; dateTo?: string;
  } = {}) {
    const offset = (page - 1) * limit;
    const conditions: string[] = ["chpi.mychpttype = 'ONB-AUDIT'"];
    const params: any[] = [];

    if (filters.status) {
      const statuses = filters.status.split(',').map(s => s.trim());
      const hasOpen = statuses.includes('Open');
      const others = statuses.filter(s => s !== 'Open');
      const parts: string[] = [];
      if (hasOpen) parts.push('chpi.mychecker IS NULL');
      if (others.length > 0) {
        parts.push(`chpi.status IN (${others.map(() => '?').join(',')})`);
        params.push(...others);
      }
      if (parts.length > 0) conditions.push(`(${parts.join(' OR ')})`);
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

    const joins = `
      FROM bp_chpi_checkprocessitem chpi
      LEFT JOIN bp_usi_useritem gv ON gv.code = chpi.mytrigger
      LEFT JOIN bp_usi_useritem aud ON aud.code = chpi.mychecker
      LEFT JOIN bp_ulc_uniquelearningcomponent ulc ON ulc.code = chpi.myulc
      LEFT JOIN bp_cap_calendarperiod cap ON cap.code = ulc.mycap`;
    const where = conditions.join(' AND ');

    const [countResult, data] = await Promise.all([
      AppDataSource.query(`SELECT COUNT(*) AS total ${joins} WHERE ${where}`, params),
      AppDataSource.query(`
        SELECT chpi.code AS chpi_code, chpi.mytrigger AS usi_code, chpi.status AS chpi_status,
               chpi.mychecker AS auditor_code, chpi.myulc, chpi.myclag,
               chpi.description AS cuie_code, chpi.created_at,
               gv.fullname, aud.fullname AS auditor_name,
               ulc.mypt, ulc.mygg, ulc.mylcp, cap.startperiod AS capstart
        ${joins}
        WHERE ${where}
        ORDER BY chpi.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]),
    ]);

    const total = Number(countResult[0]?.total || 0);

    for (const row of data) {
      row.audit_status = !row.auditor_code ? 'Open' : row.chpi_status;
      row.first_jsu_cuie_code = row.cuie_code;
    }

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async filterHotcase(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT
        d.mycuie AS cuie_code,
        d.comment AS hot_reason,
        d.myusi AS usi_code,
        usi.fullname AS gv_name,
        d.trigger_at,
        d.mypt, d.mygg, d.mylcp
      FROM staging_s2_parent_report_db.bp_cuie_details d
      INNER JOIN bp_usi_useritem usi ON usi.code = d.myusi
      LEFT JOIN bp_chpi_checkprocessitem chpi
        ON chpi.description = d.mycuie AND chpi.mychpttype = 'HOT-AUDIT'
      WHERE d.mylcet_lceventtype = 'HOT'
        AND chpi.id IS NULL
      ORDER BY d.trigger_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM staging_s2_parent_report_db.bp_cuie_details d
      LEFT JOIN bp_chpi_checkprocessitem chpi
        ON chpi.description = d.mycuie AND chpi.mychpttype = 'HOT-AUDIT'
      WHERE d.mylcet_lceventtype = 'HOT'
        AND chpi.id IS NULL
    `;

    const data = await AppDataSource.query(dataSql, [limit, offset]);
    const countResult = await AppDataSource.query(countSql);
    const total = Number(countResult[0]?.total || 0);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async filterWeekly(capWeekCode: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    // 1. CAP lookup for week date range
    const capRows = await AppDataSource.query(
      'SELECT code, description, startperiod, endperiod FROM bp_cap_calendarperiod WHERE code = ?',
      [capWeekCode],
    );
    if (!capRows.length) {
      throw { statusCode: 404, message: 'CAP week not found' };
    }
    const cap = capRows[0];

    // 2. Use EXISTS for performance — cross-DB GROUP BY too slow
    const lckPlaceholders = GvFilterService.VALID_LCK.map(() => '?').join(',');
    const dataSql = `
      SELECT usi.code AS usi_code, usi.fullname AS gv_name,
        NULL AS selected_cuie_code, NULL AS trigger_at
      FROM bp_usi_useritem usi
      WHERE usi.myust = 'TE' AND usi.active = 1
        AND EXISTS (
          SELECT 1 FROM staging_s2_parent_report_db.bp_cuie_details d
          WHERE d.myusi = usi.code
            AND d.mylcet_lceventtype = 'DR-JN-JSU'
            AND d.mylck IN (${lckPlaceholders})
            AND d.trigger_at >= ? AND d.trigger_at <= ?
        )
        AND NOT EXISTS (
          SELECT 1 FROM bp_chpi_checkprocessitem chpi
          WHERE chpi.mytrigger = usi.code AND chpi.mychpttype = 'WKL-AUDIT'
        )
      ORDER BY RAND()
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM bp_usi_useritem usi
      WHERE usi.myust = 'TE' AND usi.active = 1
        AND EXISTS (
          SELECT 1 FROM staging_s2_parent_report_db.bp_cuie_details d
          WHERE d.myusi = usi.code
            AND d.mylcet_lceventtype = 'DR-JN-JSU'
            AND d.mylck IN (${lckPlaceholders})
            AND d.trigger_at >= ? AND d.trigger_at <= ?
        )
        AND NOT EXISTS (
          SELECT 1 FROM bp_chpi_checkprocessitem chpi
          WHERE chpi.mytrigger = usi.code AND chpi.mychpttype = 'WKL-AUDIT'
        )
    `;

    const data = await AppDataSource.query(dataSql, [...GvFilterService.VALID_LCK, cap.startperiod, cap.endperiod, limit, offset]);
    const countResult = await AppDataSource.query(countSql, [...GvFilterService.VALID_LCK, cap.startperiod, cap.endperiod]);
    const total = Number(countResult[0]?.total || 0);

    // Enrich with CUIE code + PT/GG/LCT (small batch)
    if (data.length > 0) {
      const codes = data.map((r: any) => r.usi_code);
      const placeholders = codes.map(() => '?').join(',');
      const cuieRows: any[] = await AppDataSource.query(
        `SELECT myusi, MIN(mycuie) AS cuie_code, MIN(trigger_at) AS trigger_at,
                mypt, mygg, mylcp
         FROM staging_s2_parent_report_db.bp_cuie_details
         WHERE myusi IN (${placeholders})
           AND mylcet_lceventtype = 'DR-JN-JSU'
           AND mylck IN (${GvFilterService.VALID_LCK.map(() => '?').join(',')})
           AND trigger_at >= ? AND trigger_at <= ?
         GROUP BY myusi, mypt, mygg, mylcp`,
        [...codes, ...GvFilterService.VALID_LCK, cap.startperiod, cap.endperiod],
      );
      const cuieMap = new Map(cuieRows.map((r: any) => [r.myusi, r]));
      for (const row of data) {
        const cuie = cuieMap.get(row.usi_code);
        if (cuie) {
          row.selected_cuie_code = cuie.cuie_code;
          row.trigger_at = cuie.trigger_at;
          row.mypt = cuie.mypt;
          row.mygg = cuie.mygg;
          row.mylcp = cuie.mylcp;
        }
      }
    }

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async filterMonthly(capMonthCode: string, page: number, limit: number) {
    // 1. CAP lookup for month date range
    const capRows = await AppDataSource.query(
      'SELECT code, description, startperiod, endperiod FROM bp_cap_calendarperiod WHERE code = ?',
      [capMonthCode],
    );
    if (!capRows.length) {
      throw { statusCode: 404, message: 'CAP month not found' };
    }
    const cap = capRows[0];

    // 2. Get GVs with completed WEEKLY CHPI in the month
    const inheritedSql = `
      SELECT
        usi.code AS usi_code,
        usi.fullname AS gv_name,
        chpi.code AS weekly_chpi_code
      FROM bp_usi_useritem usi
      INNER JOIN bp_chpi_checkprocessitem chpi
        ON chpi.mytrigger = usi.code AND chpi.mychpttype = 'WKL-AUDIT'
        AND chpi.created_at >= ? AND chpi.created_at <= ?
      WHERE usi.myust = 'TE'
        AND usi.active = 1
    `;
    const inheritedRows: any[] = await AppDataSource.query(inheritedSql, [cap.startperiod, cap.endperiod]);

    // 3. Build inherited list — status from MySQL CHPI
    const inheritedData = inheritedRows.map((r: any) => ({
      usi_code: r.usi_code,
      gv_name: r.gv_name,
      source: 'INHERIT_WEEKLY',
      weekly_chpi_code: r.weekly_chpi_code,
      weekly_score: null,
      weekly_result: null,
      selected_cuie_code: null,
      trigger_at: null,
      mypt: null,
      mygg: null,
      mylcp: null,
    }));

    // 4. Get GVs without WEEKLY but with JSU in the month (new audit candidates)
    const inheritedUsiCodes = inheritedRows.map((r: any) => r.usi_code);
    let notInClause = '';
    let newParams: any[] = [cap.startperiod, cap.endperiod];
    if (inheritedUsiCodes.length > 0) {
      const placeholders = inheritedUsiCodes.map(() => '?').join(',');
      notInClause = `AND usi.code NOT IN (${placeholders})`;
      newParams = [...newParams, ...inheritedUsiCodes];
    }

    const lckPh = GvFilterService.VALID_LCK.map(() => '?').join(',');
    const newSql = `
      SELECT usi.code AS usi_code, usi.fullname AS gv_name,
        NULL AS selected_cuie_code, NULL AS trigger_at
      FROM bp_usi_useritem usi
      WHERE usi.myust = 'TE' AND usi.active = 1
        AND EXISTS (
          SELECT 1 FROM staging_s2_parent_report_db.bp_cuie_details d
          WHERE d.myusi = usi.code
            AND d.mylcet_lceventtype = 'DR-JN-JSU'
            AND d.mylck IN (${lckPh})
            AND d.trigger_at >= ? AND d.trigger_at <= ?
        )
        ${notInClause}
    `;
    const newRows: any[] = await AppDataSource.query(newSql, [...GvFilterService.VALID_LCK, ...newParams]);

    // Enrich new rows with CUIE code + PT/GG/LCT
    if (newRows.length > 0) {
      const newCodes = newRows.map((r: any) => r.usi_code);
      const newPlaceholders = newCodes.map(() => '?').join(',');
      const newCuieRows: any[] = await AppDataSource.query(
        `SELECT myusi, MIN(mycuie) AS cuie_code, MIN(trigger_at) AS trigger_at,
                mypt, mygg, mylcp
         FROM staging_s2_parent_report_db.bp_cuie_details
         WHERE myusi IN (${newPlaceholders})
           AND mylcet_lceventtype = 'DR-JN-JSU'
           AND mylck IN (${GvFilterService.VALID_LCK.map(() => '?').join(',')})
           AND trigger_at >= ? AND trigger_at <= ?
         GROUP BY myusi, mypt, mygg, mylcp`,
        [...newCodes, ...GvFilterService.VALID_LCK, cap.startperiod, cap.endperiod],
      );
      const newCuieMap = new Map(newCuieRows.map((r: any) => [r.myusi, r]));
      for (const row of newRows) {
        const cuie = newCuieMap.get(row.usi_code);
        if (cuie) {
          row.selected_cuie_code = cuie.cuie_code;
          row.trigger_at = cuie.trigger_at;
          row.mypt = cuie.mypt;
          row.mygg = cuie.mygg;
          row.mylcp = cuie.mylcp;
        }
      }
    }

    const newData = newRows.map((r: any) => ({
      usi_code: r.usi_code,
      gv_name: r.gv_name,
      source: 'NEW_AUDIT',
      weekly_chpi_code: null,
      weekly_score: null,
      weekly_result: null,
      selected_cuie_code: r.selected_cuie_code,
      trigger_at: r.trigger_at,
      mypt: r.mypt || null,
      mygg: r.mygg || null,
      mylcp: r.mylcp || null,
    }));

    // 5. Combine and paginate
    const allData = [...inheritedData, ...newData];
    const total = allData.length;
    const offset = (page - 1) * limit;
    const paginatedData = allData.slice(offset, offset + limit);

    // Count query for accurate total
    const countResult = await AppDataSource.query(
      'SELECT ? AS total',
      [total],
    );

    return { data: paginatedData, meta: buildPaginationMeta(total, page, limit) };
  }

  async filterRetraining(page: number, limit: number) {
    const offset = (page - 1) * limit;

    // Teachers with RETRAINING-eligible CHPI (status = 'Audited' and mychpttype != 'RTR-AUDIT')
    const countSql = `
      SELECT COUNT(*) AS total
      FROM bp_chpi_checkprocessitem chpi
      WHERE chpi.status = 'Audited' AND chpi.mychpttype != 'RTR-AUDIT'
    `;
    const countResult = await AppDataSource.query(countSql);
    const total = Number(countResult[0]?.total || 0);

    if (total === 0) {
      return { data: [], meta: buildPaginationMeta(0, page, limit) };
    }

    const dataSql = `
      SELECT chpi.code AS chpi_code, chpi.mytrigger AS usi_code,
             chpi.mychpttype AS audit_type, chpi.status,
             usi.fullname AS gv_name, usi.email AS gv_email
      FROM bp_chpi_checkprocessitem chpi
      LEFT JOIN bp_usi_useritem usi ON usi.code = chpi.mytrigger
      WHERE chpi.status = 'Audited' AND chpi.mychpttype != 'RTR-AUDIT'
      ORDER BY chpi.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const data = await AppDataSource.query(dataSql, [limit, offset]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async getOnboardFilterOptions() {
    const [ptRows, ggRows] = await Promise.all([
      AppDataSource.query(`SELECT code, name FROM bp_pt_producttype WHERE published + 0 = 1 ORDER BY code`),
      AppDataSource.query(`SELECT code, name FROM bp_gg_gradegroup WHERE published + 0 = 1
        ORDER BY LEFT(code, 1) DESC, CAST(SUBSTRING(code, 2) AS UNSIGNED) ASC`),
    ]);
    return {
      pt: ptRows.map((r: any) => ({ code: r.code, name: r.name })),
      gg: ggRows.map((r: any) => ({ code: r.code, name: r.name })),
      statuses: [
        { code: 'Open', name: 'Open' },
        { code: 'Assigned', name: 'Assigned' },
        { code: 'Auditing', name: 'Auditing' },
        { code: 'Audited', name: 'Audited' },
      ],
    };
  }

}
