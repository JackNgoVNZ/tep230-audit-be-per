import { AppDataSource } from '../../config/database';
import type { CreateChptInput, UpdateChptInput, BatchCreateChptInput, CreateChstInput, UpdateChstInput, CreateChltInput, UpdateChltInput } from './settings.schema';

export class SettingsService {
  /** Check whether mypt/mygg columns exist (migration may not have run yet) */
  private async hasMyptMygg(): Promise<boolean> {
    const cols = await AppDataSource.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'bp_chpt_checkprocesstemp'
       AND COLUMN_NAME = 'mypt'`
    );
    return cols.length > 0;
  }

  async getChptFilterOptions() {
    const [ptRows, ggRows, lcpRows, lcetRows] = await Promise.all([
      AppDataSource.query(`SELECT code, name FROM bp_pt_producttype WHERE published + 0 = 1 ORDER BY code`),
      AppDataSource.query(`SELECT code, name FROM bp_gg_gradegroup WHERE published + 0 = 1 ORDER BY LEFT(code, 1) DESC, CAST(SUBSTRING(code, 2) AS UNSIGNED) ASC`),
      AppDataSource.query(`SELECT code, code AS name FROM bp_lcp_lcperiod WHERE published + 0 = 1 ORDER BY code`),
      AppDataSource.query(`SELECT code, name FROM bp_lcet_learningcomponenteventtype WHERE published + 0 = 1 AND level = '3' ORDER BY name`),
    ]);

    return {
      pt: ptRows.map((r: any) => ({ code: r.code, name: r.name })),
      gg: ggRows.map((r: any) => ({ code: r.code, name: r.name })),
      lcp: lcpRows.map((r: any) => ({ code: r.code, name: r.name })),
      lcet: lcetRows.map((r: any) => ({ code: r.code, name: r.name })),
    };
  }

  async listChpt(page: number, limit: number, filters?: { mypt?: string; mygg?: string; mylcp?: string; mylcet?: string; published?: string }) {
    const offset = (page - 1) * limit;
    const hasCols = await this.hasMyptMygg();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.mypt) {
      if (hasCols) {
        conditions.push('mypt = ?');
      } else {
        conditions.push('code LIKE ?');
      }
      params.push(hasCols ? filters.mypt : `${filters.mypt}-%`);
    }
    if (filters?.mygg) {
      if (hasCols) {
        conditions.push('mygg = ?');
      } else {
        conditions.push('code LIKE ?');
      }
      params.push(hasCols ? filters.mygg : `%-${filters.mygg}-%`);
    }
    if (filters?.mylcp) {
      conditions.push('mylcp = ?');
      params.push(filters.mylcp);
    }
    if (filters?.mylcet) {
      conditions.push('mylcet = ?');
      params.push(filters.mylcet);
    }
    if (filters?.published === 'yes') {
      conditions.push('published + 0 = 1');
    } else if (filters?.published === 'no') {
      conditions.push('published + 0 = 0');
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const myptMyggSelect = hasCols ? 'mypt, mygg,' : '';

    const dataQuery = `
      SELECT id, code, ${myptMyggSelect} name, mylcp, myparentlcet, mylcet, triggerusertype, supust,
             timebase, timeoffsetunit, timeoffsetvalue, timeoffsetminutes,
             note, created_at, updated_at, published + 0 as published
      FROM bp_chpt_checkprocesstemp
      ${where}
      ORDER BY code ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `SELECT COUNT(*) as total FROM bp_chpt_checkprocesstemp ${where}`;

    const [data, countResult] = await Promise.all([
      AppDataSource.query(dataQuery, [...params, limit, offset]),
      AppDataSource.query(countQuery, [...params]),
    ]);

    return { data, total: Number(countResult[0]?.total || 0) };
  }

  async createChpt(input: CreateChptInput) {
    const dup = await AppDataSource.query('SELECT code FROM bp_chpt_checkprocesstemp WHERE code = ?', [input.code]);
    if (dup.length) throw { statusCode: 409, message: 'CHPT code already exists' };

    const hasCols = await this.hasMyptMygg();
    if (hasCols) {
      await AppDataSource.query(
        `INSERT INTO bp_chpt_checkprocesstemp (code, mypt, mygg, name, mylcp, mylcet, triggerusertype, supust, note, published, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, b'1', NOW())`,
        [input.code, input.mypt || null, input.mygg || null, input.name, input.mylcp || null, input.mylcet || null, input.triggerusertype || null, input.supust || null, input.note || null]
      );
    } else {
      await AppDataSource.query(
        `INSERT INTO bp_chpt_checkprocesstemp (code, name, mylcp, mylcet, triggerusertype, supust, note, published, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, b'1', NOW())`,
        [input.code, input.name, input.mylcp || null, input.mylcet || null, input.triggerusertype || null, input.supust || null, input.note || null]
      );
    }
    return { code: input.code };
  }

  async updateChpt(code: string, input: UpdateChptInput) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chpt_checkprocesstemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHPT not found' };

    const hasCols = await this.hasMyptMygg();
    const sets: string[] = [];
    const params: any[] = [];
    if (input.name) { sets.push('name = ?'); params.push(input.name); }
    if (hasCols && input.mypt !== undefined) { sets.push('mypt = ?'); params.push(input.mypt); }
    if (hasCols && input.mygg !== undefined) { sets.push('mygg = ?'); params.push(input.mygg); }
    if (input.mylcp !== undefined) { sets.push('mylcp = ?'); params.push(input.mylcp); }
    if (input.mylcet !== undefined) { sets.push('mylcet = ?'); params.push(input.mylcet); }
    if (input.triggerusertype !== undefined) { sets.push('triggerusertype = ?'); params.push(input.triggerusertype); }
    if (input.supust !== undefined) { sets.push('supust = ?'); params.push(input.supust); }
    if (input.note !== undefined) { sets.push('note = ?'); params.push(input.note); }

    if (sets.length > 0) {
      sets.push('updated_at = NOW()');
      params.push(code);
      await AppDataSource.query(`UPDATE bp_chpt_checkprocesstemp SET ${sets.join(', ')} WHERE code = ?`, params);
    }
    return { code, updated: true };
  }

  async unpublishChpt(code: string) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chpt_checkprocesstemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHPT not found' };

    await AppDataSource.query('UPDATE bp_chpt_checkprocesstemp SET published = 0, updated_at = NOW() WHERE code = ?', [code]);
    return { code, published: 0 };
  }

  async publishChpt(code: string) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chpt_checkprocesstemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHPT not found' };

    await AppDataSource.query('UPDATE bp_chpt_checkprocesstemp SET published = 1, updated_at = NOW() WHERE code = ?', [code]);
    return { code, published: 1 };
  }

  async getExistingChptByPt(pt: string) {
    const rows = await AppDataSource.query(
      `SELECT code, mygg, mylcp, mylcet FROM bp_chpt_checkprocesstemp WHERE mypt = ? ORDER BY code`,
      [pt]
    );
    return rows.map((r: any) => ({ code: r.code, mygg: r.mygg, mylcp: r.mylcp, mylcet: r.mylcet }));
  }

  async batchCreateChpt(input: BatchCreateChptInput) {
    // 1. Get LCET names for auto-naming
    const lcetRows = await AppDataSource.query(
      `SELECT code, name FROM bp_lcet_learningcomponenteventtype WHERE code IN (${input.lcet.map(() => '?').join(',')})`,
      input.lcet
    );
    const lcetNameMap: Record<string, string> = {};
    for (const r of lcetRows) {
      lcetNameMap[r.code] = r.name;
    }

    // 2. Get existing combos for this PT
    const existing = await AppDataSource.query(
      `SELECT mylcp, mylcet, mygg FROM bp_chpt_checkprocesstemp WHERE mypt = ?`,
      [input.pt]
    );
    const existingSet = new Set(
      existing.map((r: any) => `${r.mylcp}|${r.mylcet}|${r.mygg}`)
    );

    // 3. Build all combinations and filter out existing
    const toCreate: { code: string; name: string; mypt: string; mygg: string; mylcp: string; mylcet: string }[] = [];
    for (const lcp of input.lcp) {
      for (const lcet of input.lcet) {
        for (const gg of input.gg) {
          const key = `${lcp}|${lcet}|${gg}`;
          if (!existingSet.has(key)) {
            toCreate.push({
              code: `${lcp}-${lcet}-${input.pt}-${gg}`,
              name: lcetNameMap[lcet] || lcet,
              mypt: input.pt,
              mygg: gg,
              mylcp: lcp,
              mylcet: lcet,
            });
          }
        }
      }
    }

    if (toCreate.length === 0) {
      return { created: 0, skipped: 0, codes: [] };
    }

    // 4. Check for code duplicates (edge case: same code exists with different mypt)
    const allCodes = toCreate.map(r => r.code);
    const dupRows = await AppDataSource.query(
      `SELECT code FROM bp_chpt_checkprocesstemp WHERE code IN (${allCodes.map(() => '?').join(',')})`,
      allCodes
    );
    const dupSet = new Set(dupRows.map((r: any) => r.code));
    const filtered = toCreate.filter(r => !dupSet.has(r.code));
    const skipped = toCreate.length - filtered.length;

    if (filtered.length === 0) {
      return { created: 0, skipped, codes: [] };
    }

    // 5. Batch INSERT
    const values = filtered.map(r =>
      `(?, ?, ?, ?, ?, ?, b'1', NOW())`
    ).join(', ');
    const params = filtered.flatMap(r => [r.code, r.mypt, r.mygg, r.name, r.mylcp, r.mylcet]);

    await AppDataSource.query(
      `INSERT INTO bp_chpt_checkprocesstemp (code, mypt, mygg, name, mylcp, mylcet, published, created_at) VALUES ${values}`,
      params
    );

    return { created: filtered.length, skipped, codes: filtered.map(r => r.code) };
  }

  async listChst(page: number, limit: number, chptCode?: string) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let whereData = '';
    let whereCount = '';

    if (chptCode) {
      whereData = 'WHERE s.mychpt = ?';
      whereCount = 'WHERE mychpt = ?';
      params.push(chptCode);
    }

    const dataQuery = `
      SELECT s.id, s.code, s.name, s.mychpt, s.mychlt, s.checksample, s.mychrt,
             s.created_at, s.updated_at, s.published + 0 as published,
             p.mypt, p.mygg
      FROM bp_chst_checksteptemp s
      LEFT JOIN bp_chpt_checkprocesstemp p ON s.mychpt = p.code
      ${whereData}
      ORDER BY CAST(SUBSTRING_INDEX(s.code, '-', -1) AS UNSIGNED) ASC, s.code ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `SELECT COUNT(*) as total FROM bp_chst_checksteptemp ${whereCount}`;

    const [data, countResult] = await Promise.all([
      AppDataSource.query(dataQuery, [...params, limit, offset]),
      AppDataSource.query(countQuery, [...params]),
    ]);

    return { data, total: Number(countResult[0]?.total || 0) };
  }

  async createChst(input: CreateChstInput) {
    const dup = await AppDataSource.query('SELECT code FROM bp_chst_checksteptemp WHERE code = ?', [input.code]);
    if (dup.length) throw { statusCode: 409, message: 'CHST code already exists' };

    try {
      await AppDataSource.query(
        `INSERT INTO bp_chst_checksteptemp (code, name, mychpt, checksample, mychrt, published, created_at)
         VALUES (?, ?, ?, ?, ?, b'1', NOW())`,
        [input.code, input.name, input.mychpt, input.checksample || 0, input.mychrt || null]
      );
    } catch (err: any) {
      if (err.errno === 1452) throw { statusCode: 400, message: `Parent CHPT '${input.mychpt}' does not exist` };
      throw err;
    }
    return { code: input.code };
  }

  async updateChst(code: string, input: UpdateChstInput) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chst_checksteptemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHST not found' };

    const sets: string[] = [];
    const params: any[] = [];
    if (input.name) { sets.push('name = ?'); params.push(input.name); }
    if (input.checksample !== undefined) { sets.push('checksample = ?'); params.push(input.checksample); }
    if (input.mychrt !== undefined) { sets.push('mychrt = ?'); params.push(input.mychrt); }

    if (sets.length > 0) {
      sets.push('updated_at = NOW()');
      params.push(code);
      await AppDataSource.query(`UPDATE bp_chst_checksteptemp SET ${sets.join(', ')} WHERE code = ?`, params);
    }
    return { code, updated: true };
  }

  async unpublishChst(code: string) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chst_checksteptemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHST not found' };

    await AppDataSource.query('UPDATE bp_chst_checksteptemp SET published = 0, updated_at = NOW() WHERE code = ?', [code]);
    return { code, published: 0 };
  }

  async publishChst(code: string) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chst_checksteptemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHST not found' };

    await AppDataSource.query('UPDATE bp_chst_checksteptemp SET published = 1, updated_at = NOW() WHERE code = ?', [code]);
    return { code, published: 1 };
  }

  async listChlt(page: number, limit: number, chstCode?: string) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let where = '';

    let whereData = '';
    let whereCount = '';
    if (chstCode) {
      whereData = 'WHERE c.mychst = ?';
      whereCount = 'WHERE mychst = ?';
      params.push(chstCode);
    }

    const dataQuery = `
      SELECT c.id, c.code, c.subcode, c.myparentchlt, c.name, c.scoretype, c.score1,
             c.scoretype2, c.score2, c.\`do\`, c.donot, c.correctexample, c.incorrectexample,
             c.mychst, c.created_at, c.updated_at, c.published + 0 as published,
             s.name as chst_name
      FROM bp_chlt_checklisttemp c
      LEFT JOIN bp_chst_checksteptemp s ON c.mychst = s.code
      ${whereData}
      ORDER BY CAST(SUBSTRING_INDEX(c.code, '-', -1) AS UNSIGNED) ASC, c.code ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `SELECT COUNT(*) as total FROM bp_chlt_checklisttemp ${whereCount}`;

    const [data, countResult] = await Promise.all([
      AppDataSource.query(dataQuery, [...params, limit, offset]),
      AppDataSource.query(countQuery, [...params]),
    ]);

    return { data, total: Number(countResult[0]?.total || 0) };
  }

  async createChlt(input: CreateChltInput) {
    const dup = await AppDataSource.query('SELECT code FROM bp_chlt_checklisttemp WHERE code = ?', [input.code]);
    if (dup.length) throw { statusCode: 409, message: 'CHLT code already exists' };

    try {
      await AppDataSource.query(
        `INSERT INTO bp_chlt_checklisttemp (code, name, mychst, subcode, myparentchlt, scoretype, score1, scoretype2, score2, published, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, b'1', NOW())`,
        [input.code, input.name, input.mychst, input.subcode || null, input.myparentchlt || null,
         input.scoretype || null, input.score1 ?? null, input.scoretype2 || null, input.score2 ?? null]
      );
    } catch (err: any) {
      if (err.errno === 1452) throw { statusCode: 400, message: `Parent CHST '${input.mychst}' does not exist` };
      throw err;
    }
    return { code: input.code };
  }

  async updateChlt(code: string, input: UpdateChltInput) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chlt_checklisttemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHLT not found' };

    const sets: string[] = [];
    const params: any[] = [];
    if (input.name) { sets.push('name = ?'); params.push(input.name); }
    if (input.subcode !== undefined) { sets.push('subcode = ?'); params.push(input.subcode); }
    if (input.scoretype !== undefined) { sets.push('scoretype = ?'); params.push(input.scoretype); }
    if (input.score1 !== undefined) { sets.push('score1 = ?'); params.push(input.score1); }
    if (input.scoretype2 !== undefined) { sets.push('scoretype2 = ?'); params.push(input.scoretype2); }
    if (input.score2 !== undefined) { sets.push('score2 = ?'); params.push(input.score2); }

    if (sets.length > 0) {
      sets.push('updated_at = NOW()');
      params.push(code);
      await AppDataSource.query(`UPDATE bp_chlt_checklisttemp SET ${sets.join(', ')} WHERE code = ?`, params);
    }
    return { code, updated: true };
  }

  async unpublishChlt(code: string) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chlt_checklisttemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHLT not found' };

    await AppDataSource.query('UPDATE bp_chlt_checklisttemp SET published = 0, updated_at = NOW() WHERE code = ?', [code]);
    return { code, published: 0 };
  }

  async publishChlt(code: string) {
    const existing = await AppDataSource.query('SELECT code FROM bp_chlt_checklisttemp WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'CHLT not found' };

    await AppDataSource.query('UPDATE bp_chlt_checklisttemp SET published = 1, updated_at = NOW() WHERE code = ?', [code]);
    return { code, published: 1 };
  }
}
