import { localQuery } from '../../config/local-query';
import { AppError } from '../../middleware/error-handler.middleware';
import { UpdateThresholdInput } from './threshold.schema';

export class ThresholdService {
  /**
   * List all threshold configs
   */
  async listThresholds() {
    const data = await localQuery(
      `SELECT * FROM audit_threshold_config ORDER BY audit_type, min_score ASC`
    );
    return data;
  }

  /**
   * Get thresholds for specific audit type
   */
  async getByAuditType(auditType: string) {
    const data = await localQuery(
      `SELECT * FROM audit_threshold_config WHERE audit_type = ? ORDER BY min_score ASC`,
      [auditType]
    );
    return data;
  }

  /**
   * Update threshold config (ADM only)
   */
  async updateThreshold(id: number, input: UpdateThresholdInput) {
    const rows = await localQuery(
      'SELECT * FROM audit_threshold_config WHERE id = ?',
      [id]
    );
    if (!rows.length) throw new AppError('Threshold config not found', 404);

    const setClauses: string[] = [];
    const params: any[] = [];

    if (input.min_score !== undefined) {
      setClauses.push('min_score = ?');
      params.push(input.min_score);
    }
    if (input.max_score !== undefined) {
      setClauses.push('max_score = ?');
      params.push(input.max_score);
    }
    if (input.has_second_audit !== undefined) {
      setClauses.push('has_second_audit = ?');
      params.push(input.has_second_audit);
    }
    if (input.has_unreg4 !== undefined) {
      setClauses.push('has_unreg4 = ?');
      params.push(input.has_unreg4);
    }
    if (input.published !== undefined) {
      setClauses.push('published = ?');
      params.push(input.published);
    }

    if (setClauses.length > 0) {
      setClauses.push("updated_at = datetime('now')");
      params.push(id);

      await localQuery(
        `UPDATE audit_threshold_config SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    }

    // Return updated record
    const updated = await localQuery(
      'SELECT * FROM audit_threshold_config WHERE id = ?',
      [id]
    );
    return updated[0];
  }
}
