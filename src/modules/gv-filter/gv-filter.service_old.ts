import { AppDataSource } from '../../config/database';
import { localQuery } from '../../config/local-query';
import { AppError } from '../../middleware/error-handler.middleware';

export class GvFilterService {
  /**
   * ONBOARD filter: GV mới có JSU đầu tiên chưa được audit
   * Logic: USI có myust=TE, active=1, có CUIE nhưng chưa có CHPI ONBOARD
   */
  async filterOnboard(page: number, limit: number) {
    const offset = (page - 1) * limit;

    // MySQL only: USI with no ONBOARD CHPI (chpi.id IS NULL means no ass row either)
    const query = `
      SELECT DISTINCT
        usi.id, usi.code, usi.fullname, usi.email, usi.phone, usi.myust,
        MIN(cuie.trigger_at) as first_event_at,
        COUNT(DISTINCT cuie.id) as event_count
      FROM bp_usi_useritem usi
      INNER JOIN bp_cuie_cuievent cuie ON cuie.myusi = usi.code
      LEFT JOIN bp_chpi_checkprocessitem chpi
        ON chpi.mytrigger = usi.code
        AND chpi.mychpt IN (SELECT code FROM bp_chpt_checkprocesstemp WHERE mylcet LIKE '%ONBOARD%')
      WHERE usi.active = 1
        AND chpi.id IS NULL
      GROUP BY usi.id, usi.code, usi.fullname, usi.email, usi.phone, usi.myust
      ORDER BY first_event_at ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT usi.id) as total
      FROM bp_usi_useritem usi
      INNER JOIN bp_cuie_cuievent cuie ON cuie.myusi = usi.code
      LEFT JOIN bp_chpi_checkprocessitem chpi
        ON chpi.mytrigger = usi.code
        AND chpi.mychpt IN (SELECT code FROM bp_chpt_checkprocesstemp WHERE mylcet LIKE '%ONBOARD%')
      WHERE usi.active = 1
        AND chpi.id IS NULL
    `;

    const [data, countResult] = await Promise.all([
      AppDataSource.query(query, [limit, offset]),
      AppDataSource.query(countQuery),
    ]);

    return { data, total: countResult[0]?.total || 0 };
  }

  /**
   * HOTCASE filter: GV có event HOT (cuie với mylcet_lceventtype chứa HOT)
   */
  async filterHotcase(page: number, limit: number) {
    const offset = (page - 1) * limit;

    // Step 1: MySQL - get HOT events with their CHPI codes (if any)
    const allHotEvents: any[] = await AppDataSource.query(
      `SELECT DISTINCT
        usi.id, usi.code, usi.fullname, usi.email, usi.phone,
        cuie.code as cuie_code, cuie.mylcet_lceventtype, cuie.trigger_at,
        cuie.name as event_name,
        chpi.code as chpi_code
       FROM bp_cuie_cuievent cuie
       INNER JOIN bp_usi_useritem usi ON usi.code = cuie.myusi
       LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mycuievent = cuie.code
       WHERE cuie.mylcet_lceventtype LIKE '%HOT%'
         AND usi.active = 1
       ORDER BY cuie.trigger_at DESC`
    );

    // Step 2: SQLite - get existing HOTCASE session statuses
    const existingChpiCodes = allHotEvents
      .filter((e: any) => e.chpi_code)
      .map((e: any) => e.chpi_code);

    let auditedChpiSet = new Set<string>();
    if (existingChpiCodes.length > 0) {
      const placeholders = existingChpiCodes.map(() => '?').join(',');
      const auditedRows: any[] = await localQuery(
        `SELECT chpi_code FROM audit_session_status
         WHERE chpi_code IN (${placeholders}) AND audit_type = 'HOTCASE'`,
        existingChpiCodes
      );
      auditedChpiSet = new Set(auditedRows.map((r: any) => r.chpi_code));
    }

    // Step 3: Filter - keep events with no CHPI or CHPI not in auditedChpiSet
    const filtered = allHotEvents.filter((e: any) =>
      !e.chpi_code || !auditedChpiSet.has(e.chpi_code)
    );

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit).map(({ chpi_code, ...rest }: any) => rest);

    return { data, total };
  }

  /**
   * WEEKLY filter: Random 10% GV + random 1 JSU per GV
   */
  async filterWeekly(page: number, limit: number) {
    const offset = (page - 1) * limit;

    // Lấy danh sách GV active có CUIE trong tuần gần nhất
    const query = `
      SELECT DISTINCT
        usi.id, usi.code, usi.fullname, usi.email, usi.phone,
        COUNT(DISTINCT cuie.id) as weekly_events
      FROM bp_usi_useritem usi
      INNER JOIN bp_cuie_cuievent cuie ON cuie.myusi = usi.code
      WHERE usi.active = 1
        AND cuie.trigger_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY usi.id, usi.code, usi.fullname, usi.email, usi.phone
      ORDER BY RAND()
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT usi.id) as total
      FROM bp_usi_useritem usi
      INNER JOIN bp_cuie_cuievent cuie ON cuie.myusi = usi.code
      WHERE usi.active = 1
        AND cuie.trigger_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;

    const [data, countResult] = await Promise.all([
      AppDataSource.query(query, [limit, offset]),
      AppDataSource.query(countQuery),
    ]);

    return { data, total: countResult[0]?.total || 0 };
  }

  /**
   * MONTHLY filter: Inherit từ WEEKLY hoặc random 1 GV/tháng
   */
  async filterMonthly(page: number, limit: number) {
    const offset = (page - 1) * limit;

    // Step 1: MySQL - get active users with pagination
    const usersQuery = `
      SELECT DISTINCT
        usi.id, usi.code, usi.fullname, usi.email, usi.phone
      FROM bp_usi_useritem usi
      WHERE usi.active = 1
      ORDER BY usi.fullname ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT usi.id) as total
      FROM bp_usi_useritem usi
      WHERE usi.active = 1
    `;

    const [users, countResult] = await Promise.all([
      AppDataSource.query(usersQuery, [limit, offset]),
      AppDataSource.query(countQuery),
    ]);

    // Step 2: SQLite - get completed WEEKLY sessions
    const weeklySessionRows: any[] = await localQuery(
      `SELECT chpi_code, total_score, threshold_result
       FROM audit_session_status
       WHERE audit_type = 'WEEKLY' AND status = 'COMPLETED'`
    );

    // Step 3: MySQL - get CHPI trigger mappings for weekly sessions
    let weeklyMap = new Map<string, any>();
    if (weeklySessionRows.length > 0) {
      const chpiCodes = weeklySessionRows.map((r: any) => r.chpi_code);
      const placeholders = chpiCodes.map(() => '?').join(',');
      const chpiRows: any[] = await AppDataSource.query(
        `SELECT code, mytrigger FROM bp_chpi_checkprocessitem WHERE code IN (${placeholders})`,
        chpiCodes
      );
      const chpiTriggerMap = new Map(chpiRows.map((r: any) => [r.code, r.mytrigger]));

      for (const session of weeklySessionRows) {
        const triggerCode = chpiTriggerMap.get(session.chpi_code);
        if (triggerCode) {
          weeklyMap.set(triggerCode, {
            weekly_chpi: session.chpi_code,
            weekly_score: session.total_score,
            weekly_result: session.threshold_result,
          });
        }
      }
    }

    // Step 4: Merge
    const data = users.map((user: any) => ({
      ...user,
      weekly_chpi: weeklyMap.get(user.code)?.weekly_chpi || null,
      weekly_score: weeklyMap.get(user.code)?.weekly_score || null,
      weekly_result: weeklyMap.get(user.code)?.weekly_result || null,
    }));

    return { data, total: countResult[0]?.total || 0 };
  }
}
