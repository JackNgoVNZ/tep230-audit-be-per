import { AppDataSource } from '../../config/database';

export class EventListenerService {
  /**
   * Get recent CUIE events
   */
  async getRecentEvents(page: number, limit: number, eventType?: string) {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (eventType) {
      where += ' AND cuie.mylcet_lceventtype LIKE ?';
      params.push(`%${eventType}%`);
    }

    const query = `
      SELECT
        cuie.id, cuie.code, cuie.name, cuie.mycui,
        cuie.mylcet_lceventtype, cuie.mystep,
        cuie.trigger_at, cuie.eventplantime,
        cuie.eventactualtime_fet, cuie.eventactualtime_bet,
        cuie.myusi, cuie.mybpe, cuie.published,
        cuie.created_at,
        usi.fullname as teacher_name, usi.email as teacher_email
      FROM bp_cuie_cuievent cuie
      LEFT JOIN bp_usi_useritem usi ON usi.code = cuie.myusi
      ${where}
      ORDER BY cuie.trigger_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bp_cuie_cuievent cuie
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
   * Manually trigger CUIE polling
   * Checks for new events and returns unprocessed ones
   */
  async pollEvents() {
    // Get events that don't have a corresponding CHPI yet
    const unprocessedEvents = await AppDataSource.query(
      `SELECT
        cuie.id, cuie.code, cuie.name, cuie.mylcet_lceventtype,
        cuie.trigger_at, cuie.myusi,
        usi.fullname as teacher_name
       FROM bp_cuie_cuievent cuie
       LEFT JOIN bp_usi_useritem usi ON usi.code = cuie.myusi
       LEFT JOIN bp_chpi_checkprocessitem chpi ON chpi.mycuievent = cuie.code
       WHERE chpi.id IS NULL
         AND cuie.published = 1
         AND cuie.trigger_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY cuie.trigger_at DESC
       LIMIT 50`
    );

    return {
      polledAt: new Date().toISOString(),
      unprocessedEvents: unprocessedEvents.length,
      events: unprocessedEvents,
    };
  }
}
