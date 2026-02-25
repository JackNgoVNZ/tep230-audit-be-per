import { AppDataSource } from '../../config/database';
import { localQuery } from '../../config/local-query';
import { AppError } from '../../middleware/error-handler.middleware';

export class ScoringService {
  /**
   * Calculate score for an audit process
   * Formula: SUM(CHLI.score1) / SUM(CHLT.score1) * 5.0
   */
  async calculateScore(chpiCode: string) {
    // Verify process exists
    const processRows = await AppDataSource.query(
      'SELECT code FROM bp_chpi_checkprocessitem WHERE code = ?',
      [chpiCode]
    );
    if (!processRows.length) throw new AppError('Audit process not found', 404);

    // Calculate: SUM actual scores / SUM template max scores * 5.0
    const scoreResult = await AppDataSource.query(
      `SELECT
        SUM(CAST(chli.score1 AS DECIMAL(10,2))) as total_actual,
        SUM(CAST(chlt.score1 AS DECIMAL(10,2))) as total_max,
        COUNT(chli.id) as total_items,
        SUM(CASE WHEN chli.score1 IS NOT NULL THEN 1 ELSE 0 END) as scored_items
       FROM bp_chli_checklistitem chli
       INNER JOIN bp_chsi_checkstepitem chsi ON chsi.code = chli.mychsi
       LEFT JOIN bp_chlt_checklisttemp chlt ON chlt.code = chli.mysubchlt
       WHERE chsi.mychpi = ?`,
      [chpiCode]
    );

    const totalActual = parseFloat(scoreResult[0]?.total_actual) || 0;
    const totalMax = parseFloat(scoreResult[0]?.total_max) || 0;
    const totalItems = parseInt(scoreResult[0]?.total_items) || 0;
    const scoredItems = parseInt(scoreResult[0]?.scored_items) || 0;

    let finalScore = 0;
    if (totalMax > 0) {
      finalScore = Math.round((totalActual / totalMax) * 5.0 * 100) / 100;
    }

    return {
      chpiCode,
      totalActual,
      totalMax,
      finalScore,
      maxScore: 5.0,
      totalItems,
      scoredItems,
    };
  }

  /**
   * Check score against threshold config
   * Returns PASS / RETRAIN / TERMINATE
   */
  async checkThreshold(chpiCode: string) {
    // Get audit type (SQLite - supplementary table)
    const sessionRows = await localQuery(
      'SELECT * FROM audit_session_status WHERE chpi_code = ?',
      [chpiCode]
    );
    if (!sessionRows.length) throw new AppError('Audit session not found', 404);

    const session = sessionRows[0];

    // Calculate score first
    const scoreData = await this.calculateScore(chpiCode);

    // Get threshold configs for this audit type (SQLite - supplementary table)
    const thresholds = await localQuery(
      `SELECT * FROM audit_threshold_config
       WHERE audit_type = ? AND published = 1
       ORDER BY min_score ASC`,
      [session.audit_type]
    );

    let thresholdResult = 'PASS';

    for (const threshold of thresholds) {
      const minScore = parseFloat(threshold.min_score) || 0;
      const maxScore = parseFloat(threshold.max_score) || 5;

      if (scoreData.finalScore >= minScore && scoreData.finalScore <= maxScore) {
        thresholdResult = threshold.threshold_type;
        break;
      }
    }

    return {
      chpiCode,
      auditType: session.audit_type,
      finalScore: scoreData.finalScore,
      thresholdResult,
      isSecondAudit: session.is_second_audit === 1,
      thresholdConfigs: thresholds,
    };
  }

  /**
   * Complete audit: calculate score + check threshold + update status
   */
  async completeAudit(chpiCode: string) {
    // Calculate score
    const scoreData = await this.calculateScore(chpiCode);

    // Check threshold
    const thresholdData = await this.checkThreshold(chpiCode);

    // Update audit_session_status with score and result (SQLite - supplementary table)
    await localQuery(
      `UPDATE audit_session_status
       SET status = 'COMPLETED',
           total_score = ?,
           threshold_result = ?,
           completed_at = datetime('now'),
           updated_at = datetime('now')
       WHERE chpi_code = ?`,
      [scoreData.finalScore, thresholdData.thresholdResult, chpiCode]
    );

    return {
      chpiCode,
      status: 'COMPLETED',
      totalScore: scoreData.finalScore,
      maxScore: 5.0,
      thresholdResult: thresholdData.thresholdResult,
      totalItems: scoreData.totalItems,
      scoredItems: scoreData.scoredItems,
    };
  }
}
