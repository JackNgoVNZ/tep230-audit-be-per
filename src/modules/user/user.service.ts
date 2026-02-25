import { AppDataSource } from '../../config/database';

export class UserService {
  // Scope: chỉ hiển thị USI có USID duty trong TO/QA/QS
  private readonly SCOPE_ROLES = ['TO', 'QA', 'QS'];

  async listUsers(
    page: number,
    limit: number,
    filters: { myust?: string; keyword?: string; active?: string }
  ) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    const conditions: string[] = [];

    // Luôn filter theo scope roles qua bảng bp_usid_usiduty
    conditions.push(`d.myust IN (${this.SCOPE_ROLES.map(() => '?').join(', ')})`);
    params.push(...this.SCOPE_ROLES);

    // Filter thêm theo UST cụ thể (trong scope)
    if (filters.myust) {
      conditions.push('d.myust = ?');
      params.push(filters.myust);
    }

    if (filters.keyword) {
      conditions.push('(usi.fullname LIKE ? OR usi.username LIKE ? OR usi.code LIKE ?)');
      params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
    }

    if (filters.active !== undefined) {
      conditions.push(`d.published = b'${filters.active === '1' ? '1' : '0'}'`);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const dataQuery = `
      SELECT
        usi.code, usi.username, usi.fullname,
        usi.email, usi.phone,
        d.code AS usid_code, d.myust,
        d.published + 0 AS active,
        usi.created_at
      FROM bp_usi_useritem usi
      INNER JOIN bp_usid_usiduty d ON d.myusi = usi.code
      ${where}
      ORDER BY usi.fullname ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bp_usi_useritem usi
      INNER JOIN bp_usid_usiduty d ON d.myusi = usi.code
      ${where}
    `;

    const dataParams = [...params, limit, offset];
    const countParams = [...params];

    const [data, countResult] = await Promise.all([
      AppDataSource.query(dataQuery, dataParams),
      AppDataSource.query(countQuery, countParams),
    ]);

    return { data, total: Number(countResult[0]?.total || 0) };
  }

  async getByCode(code: string) {
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

    if (!rows.length) {
      return null;
    }

    const [usidList, podCountResult] = await Promise.all([
      AppDataSource.query(
        'SELECT id, code, myusi, created_at, updated_at FROM bp_usid_usiduty WHERE myusi = ?',
        [code]
      ),
      AppDataSource.query(
        'SELECT COUNT(*) as count FROM bp_pod_productofdeal WHERE myusi = ?',
        [code]
      ),
    ]);

    return {
      user: rows[0],
      usid_list: usidList,
      pod_count: Number(podCountResult[0]?.count || 0),
    };
  }

  async getAuditHistory(
    code: string,
    page: number,
    limit: number,
    type?: string,
  ) {
    const offset = (page - 1) * limit;
    const conditions = ['CHPI.mytrigger = ?'];
    const params: any[] = [code];
    const countParams: any[] = [code];

    if (type) {
      conditions.push('CHPI.mychpttype = ?');
      params.push(type);
      countParams.push(type);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const data = await AppDataSource.query(
      `SELECT code, name, mychpttype, mychecker, mycuievent, status, created_at
       FROM bp_chpi_checkprocessitem CHPI
       ${where}
       ORDER BY CHPI.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const countResult = await AppDataSource.query(
      `SELECT COUNT(*) as total FROM bp_chpi_checkprocessitem CHPI ${where}`,
      countParams,
    );
    const total = Number(countResult[0]?.total || 0);

    // Map CHPI fields to response shape (status is now on MySQL CHPI)
    for (const item of data) {
      item.audit_type = item.mychpttype;
      item.status = item.status || null;
      item.total_score = null;
      item.threshold_result = null;
      item.completed_at = null;
    }

    return { data, total };
  }

  async lookupByUsername(username: string) {
    const rows = await AppDataSource.query(
      `SELECT code, username, fullname, email, phone, active + 0 AS active
       FROM bp_usi_useritem WHERE username = ? LIMIT 1`,
      [username]
    );
    if (!rows.length) return null;

    const user = rows[0];
    const duties = await AppDataSource.query(
      'SELECT code, myust FROM bp_usid_usiduty WHERE myusi = ?',
      [user.code]
    );
    return { ...user, duties };
  }

  async createUser(input: { username: string; fullname: string; email?: string; phone?: string; myust: string }) {
    const existing = await AppDataSource.query('SELECT code FROM bp_usi_useritem WHERE username = ?', [input.username]);

    let usiCode: string;

    if (existing.length) {
      // USI already exists — reuse existing code
      usiCode = existing[0].code;

      // Check if this USI already has a USID with the same myust
      const dupDuty = await AppDataSource.query(
        'SELECT code FROM bp_usid_usiduty WHERE myusi = ? AND myust = ?',
        [usiCode, input.myust]
      );
      if (dupDuty.length) {
        throw { statusCode: 409, message: `User already has duty ${input.myust}` };
      }
    } else {
      // Create new USI
      usiCode = `USI-${Date.now().toString(36).toUpperCase()}`;
      await AppDataSource.query(
        `INSERT INTO bp_usi_useritem (code, username, fullname, email, phone, myust, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
        [usiCode, input.username, input.fullname, input.email || null, input.phone || null, input.myust]
      );
    }

    // Always create new USID (published = 1)
    const usidCode = `USID-${Date.now().toString(36).toUpperCase()}`;
    await AppDataSource.query(
      `INSERT INTO bp_usid_usiduty (code, myusi, myust, published, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())`,
      [usidCode, usiCode, input.myust]
    );

    return { code: usiCode, username: input.username, usidCode, isNew: !existing.length };
  }

  async updateUser(code: string, input: { fullname?: string; email?: string; phone?: string; myust?: string }) {
    const existing = await AppDataSource.query('SELECT code FROM bp_usi_useritem WHERE code = ?', [code]);
    if (!existing.length) throw { statusCode: 404, message: 'User not found' };

    const sets: string[] = [];
    const params: any[] = [];
    if (input.fullname) { sets.push('fullname = ?'); params.push(input.fullname); }
    if (input.email) { sets.push('email = ?'); params.push(input.email); }
    if (input.phone !== undefined) { sets.push('phone = ?'); params.push(input.phone); }
    if (input.myust) { sets.push('myust = ?'); params.push(input.myust); }

    if (sets.length > 0) {
      params.push(code);
      await AppDataSource.query(`UPDATE bp_usi_useritem SET ${sets.join(', ')} WHERE code = ?`, params);
    }
    return { code, updated: true };
  }

  async unpublishUsid(usidCode: string) {
    const existing = await AppDataSource.query('SELECT code FROM bp_usid_usiduty WHERE code = ?', [usidCode]);
    if (!existing.length) throw { statusCode: 404, message: 'USID not found' };

    await AppDataSource.query('UPDATE bp_usid_usiduty SET published = 0 WHERE code = ?', [usidCode]);
    return { usid_code: usidCode, active: 0 };
  }

  async publishUsid(usidCode: string) {
    const existing = await AppDataSource.query('SELECT code FROM bp_usid_usiduty WHERE code = ?', [usidCode]);
    if (!existing.length) throw { statusCode: 404, message: 'USID not found' };

    await AppDataSource.query('UPDATE bp_usid_usiduty SET published = 1 WHERE code = ?', [usidCode]);
    return { usid_code: usidCode, active: 1 };
  }
}
