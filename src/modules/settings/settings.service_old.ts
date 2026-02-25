import { AppDataSource } from '../../config/database';

export class SettingsService {
  /**
   * List checklist templates (CHLT)
   */
  async listChecklistTemplates(page: number, limit: number, chstCode?: string) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (chstCode) {
      where += ' AND chlt.mychst = ?';
      params.push(chstCode);
    }

    const query = `
      SELECT
        chlt.id, chlt.code, chlt.subcode, chlt.name,
        chlt.myparentchlt, chlt.mychst,
        chlt.scoretype, chlt.score1, chlt.scoretype2, chlt.score2,
        chlt.\`do\`, chlt.donot, chlt.correctexample, chlt.incorrectexample,
        chlt.published, chlt.created_at
      FROM bp_chlt_checklisttemp chlt
      ${where}
      ORDER BY chlt.id ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total FROM bp_chlt_checklisttemp chlt ${where}
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
   * List process templates (CHPT)
   */
  async listProcessTemplates(page: number, limit: number) {
    const offset = (page - 1) * limit;

    const query = `
      SELECT
        chpt.id, chpt.code, chpt.name, chpt.mylcp, chpt.myparentlcet,
        chpt.mylcet, chpt.triggerusertype, chpt.supust,
        chpt.timebase, chpt.timeoffsetunit, chpt.timeoffsetvalue,
        chpt.timeoffsetminutes, chpt.note, chpt.published, chpt.created_at,
        COUNT(DISTINCT chst.id) as step_count
      FROM bp_chpt_checkprocesstemp chpt
      LEFT JOIN bp_chst_checksteptemp chst ON chst.mychpt = chpt.code
      GROUP BY chpt.id, chpt.code, chpt.name, chpt.mylcp, chpt.myparentlcet,
               chpt.mylcet, chpt.triggerusertype, chpt.supust,
               chpt.timebase, chpt.timeoffsetunit, chpt.timeoffsetvalue,
               chpt.timeoffsetminutes, chpt.note, chpt.published, chpt.created_at
      ORDER BY chpt.id ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total FROM bp_chpt_checkprocesstemp
    `;

    const [data, countResult] = await Promise.all([
      AppDataSource.query(query, [limit, offset]),
      AppDataSource.query(countQuery),
    ]);

    return { data, total: countResult[0]?.total || 0 };
  }

  /**
   * List step templates (CHST)
   */
  async listStepTemplates(page: number, limit: number, chptCode?: string) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (chptCode) {
      where += ' AND chst.mychpt = ?';
      params.push(chptCode);
    }

    const query = `
      SELECT
        chst.id, chst.code, chst.name, chst.mychpt, chst.mychlt,
        chst.checksample, chst.mychrt, chst.published, chst.created_at,
        chpt.name as process_template_name,
        COUNT(DISTINCT chlt.id) as checklist_count
      FROM bp_chst_checksteptemp chst
      LEFT JOIN bp_chpt_checkprocesstemp chpt ON chpt.code = chst.mychpt
      LEFT JOIN bp_chlt_checklisttemp chlt ON chlt.mychst = chst.code
      ${where}
      GROUP BY chst.id, chst.code, chst.name, chst.mychpt, chst.mychlt,
               chst.checksample, chst.mychrt, chst.published, chst.created_at,
               chpt.name
      ORDER BY chst.id ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total FROM bp_chst_checksteptemp chst ${where}
    `;

    params.push(limit, offset);
    const countParams = params.slice(0, -2);

    const [data, countResult] = await Promise.all([
      AppDataSource.query(query, params),
      AppDataSource.query(countQuery, countParams),
    ]);

    return { data, total: countResult[0]?.total || 0 };
  }
}
