import { AppDataSource } from '../../config/database';
import { localQuery } from '../../config/local-query';
import { AppError } from '../../middleware/error-handler.middleware';

export class AuditStepService {
  /**
   * List steps for a given audit process (CHPI)
   */
  async listSteps(chpiCode: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const query = `
      SELECT
        chsi.id, chsi.code, chsi.name, chsi.checksample,
        chsi.mychpi, chsi.mychri, chsi.mychst,
        chsi.created_at, chsi.description,
        chst.name as step_template_name,
        usi.fullname as checker_name,
        COUNT(chli.id) as checklist_count,
        SUM(CASE WHEN chli.score1 IS NOT NULL THEN 1 ELSE 0 END) as scored_count
      FROM bp_chsi_checkstepitem chsi
      LEFT JOIN bp_chst_checksteptemp chst ON chst.code = chsi.mychst
      LEFT JOIN bp_usi_useritem usi ON usi.code = chsi.mychri
      LEFT JOIN bp_chli_checklistitem chli ON chli.mychsi = chsi.code
      WHERE chsi.mychpi = ?
      GROUP BY chsi.id, chsi.code, chsi.name, chsi.checksample,
               chsi.mychpi, chsi.mychri, chsi.mychst,
               chsi.created_at, chsi.description,
               chst.name, usi.fullname
      ORDER BY chsi.id ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bp_chsi_checkstepitem
      WHERE mychpi = ?
    `;

    const [data, countResult] = await Promise.all([
      AppDataSource.query(query, [chpiCode, limit, offset]),
      AppDataSource.query(countQuery, [chpiCode]),
    ]);

    return { data, total: countResult[0]?.total || 0 };
  }

  /**
   * Get step detail with its checklist items
   */
  async getStepDetail(chsiCode: string) {
    const stepRows = await AppDataSource.query(
      `SELECT chsi.*, chst.name as step_template_name, usi.fullname as checker_name
       FROM bp_chsi_checkstepitem chsi
       LEFT JOIN bp_chst_checksteptemp chst ON chst.code = chsi.mychst
       LEFT JOIN bp_usi_useritem usi ON usi.code = chsi.mychri
       WHERE chsi.code = ?`,
      [chsiCode]
    );

    if (!stepRows.length) throw new AppError('Audit step not found', 404);

    const checklists = await AppDataSource.query(
      `SELECT chli.*, chlt.name as template_name, chlt.scoretype as template_scoretype,
              chlt.score1 as template_max_score1
       FROM bp_chli_checklistitem chli
       LEFT JOIN bp_chlt_checklisttemp chlt ON chlt.code = chli.mysubchlt
       WHERE chli.mychsi = ?
       ORDER BY chli.id ASC`,
      [chsiCode]
    );

    return { step: stepRows[0], checklists };
  }

  /**
   * Mark step as started - update audit_session_status to IN_PROGRESS
   */
  async startStep(chsiCode: string, userCode: string) {
    const stepRows = await AppDataSource.query(
      'SELECT * FROM bp_chsi_checkstepitem WHERE code = ?',
      [chsiCode]
    );
    if (!stepRows.length) throw new AppError('Audit step not found', 404);

    const step = stepRows[0];

    // Update audit_session_status to IN_PROGRESS (SQLite)
    await localQuery(
      `UPDATE audit_session_status
       SET status = 'IN_PROGRESS', started_at = COALESCE(started_at, datetime('now')), updated_at = datetime('now')
       WHERE chpi_code = ? AND status IN ('PENDING', 'ASSIGNED')`,
      [step.mychpi]
    );

    // Update step description to mark as started
    await AppDataSource.query(
      `UPDATE bp_chsi_checkstepitem SET description = CONCAT(COALESCE(description, ''), ' [STARTED by ${userCode}]'), updated_at = NOW() WHERE code = ?`,
      [chsiCode]
    );

    return { chsiCode, chpiCode: step.mychpi, status: 'IN_PROGRESS' };
  }

  /**
   * Mark step as completed - check all checklist items scored
   */
  async completeStep(chsiCode: string, userCode: string) {
    const stepRows = await AppDataSource.query(
      'SELECT * FROM bp_chsi_checkstepitem WHERE code = ?',
      [chsiCode]
    );
    if (!stepRows.length) throw new AppError('Audit step not found', 404);

    const step = stepRows[0];

    // Check if all checklist items have been scored
    const unscoredResult = await AppDataSource.query(
      `SELECT COUNT(*) as unscored
       FROM bp_chli_checklistitem
       WHERE mychsi = ? AND score1 IS NULL`,
      [chsiCode]
    );

    if (unscoredResult[0]?.unscored > 0) {
      throw new AppError(`Cannot complete step: ${unscoredResult[0].unscored} checklist items not yet scored`, 400);
    }

    // Mark step description as completed
    await AppDataSource.query(
      `UPDATE bp_chsi_checkstepitem SET description = CONCAT(COALESCE(description, ''), ' [COMPLETED by ${userCode}]'), updated_at = NOW() WHERE code = ?`,
      [chsiCode]
    );

    // Check if all steps for this process are completed
    const allStepsResult = await AppDataSource.query(
      `SELECT COUNT(*) as total_steps,
              SUM(CASE WHEN chsi.description LIKE '%[COMPLETED%' THEN 1 ELSE 0 END) as completed_steps
       FROM bp_chsi_checkstepitem chsi
       WHERE chsi.mychpi = ?`,
      [step.mychpi]
    );

    const allCompleted = allStepsResult[0]?.total_steps === allStepsResult[0]?.completed_steps;

    return {
      chsiCode,
      chpiCode: step.mychpi,
      stepCompleted: true,
      allStepsCompleted: allCompleted,
      totalSteps: allStepsResult[0]?.total_steps || 0,
      completedSteps: allStepsResult[0]?.completed_steps || 0,
    };
  }
}
