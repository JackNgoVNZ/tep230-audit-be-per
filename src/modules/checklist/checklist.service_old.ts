import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error-handler.middleware';
import { BatchUpdateInput } from './checklist.schema';

export class ChecklistService {
  /**
   * Get checklist items for a step, grouped by parent
   */
  async getChecklistsByStep(chsiCode: string) {
    const items = await AppDataSource.query(
      `SELECT
        chli.id, chli.code, chli.subcode, chli.name,
        chli.mychsi, chli.myparentchlt, chli.mysubchlt, chli.myparentchli,
        chli.scoretype1, chli.score1, chli.scoretype2, chli.score2,
        chli.description,
        chli.\`do\`, chli.donot, chli.correctexample, chli.incorrectexample,
        chlt.name as template_name, chlt.scoretype as template_scoretype,
        chlt.score1 as template_max_score1, chlt.scoretype2 as template_scoretype2,
        chlt.score2 as template_max_score2
       FROM bp_chli_checklistitem chli
       LEFT JOIN bp_chlt_checklisttemp chlt ON chlt.code = chli.mysubchlt
       WHERE chli.mychsi = ?
       ORDER BY chli.myparentchlt, chli.id ASC`,
      [chsiCode]
    );

    // Group by parent
    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      const parentKey = item.myparentchlt || 'root';
      if (!grouped[parentKey]) grouped[parentKey] = [];
      grouped[parentKey].push(item);
    }

    return { items, grouped, total: items.length };
  }

  /**
   * Batch update checklist scores
   */
  async batchUpdate(input: BatchUpdateInput) {
    const results: any[] = [];

    for (const item of input.items) {
      // Verify item exists
      const rows = await AppDataSource.query(
        'SELECT id, code FROM bp_chli_checklistitem WHERE code = ?',
        [item.code]
      );
      if (!rows.length) {
        throw new AppError(`Checklist item not found: ${item.code}`, 404);
      }

      const setClauses: string[] = [];
      const params: any[] = [];

      if (item.score1 !== undefined) {
        setClauses.push('score1 = ?');
        params.push(item.score1);
      }
      if (item.score2 !== undefined) {
        setClauses.push('score2 = ?');
        params.push(item.score2);
      }
      if (item.description !== undefined) {
        setClauses.push('description = ?');
        params.push(item.description);
      }

      if (setClauses.length > 0) {
        setClauses.push('updated_at = NOW()');
        params.push(item.code);

        await AppDataSource.query(
          `UPDATE bp_chli_checklistitem SET ${setClauses.join(', ')} WHERE code = ?`,
          params
        );
      }

      results.push({ code: item.code, updated: true });
    }

    return { updated: results.length, items: results };
  }

  /**
   * Update single checklist item score
   */
  async updateSingle(code: string, score1?: string | null, score2?: string | null, description?: string | null) {
    const rows = await AppDataSource.query(
      'SELECT id, code FROM bp_chli_checklistitem WHERE code = ?',
      [code]
    );
    if (!rows.length) throw new AppError('Checklist item not found', 404);

    const setClauses: string[] = [];
    const params: any[] = [];

    if (score1 !== undefined) {
      setClauses.push('score1 = ?');
      params.push(score1);
    }
    if (score2 !== undefined) {
      setClauses.push('score2 = ?');
      params.push(score2);
    }
    if (description !== undefined) {
      setClauses.push('description = ?');
      params.push(description);
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = NOW()');
      params.push(code);

      await AppDataSource.query(
        `UPDATE bp_chli_checklistitem SET ${setClauses.join(', ')} WHERE code = ?`,
        params
      );
    }

    return { code, updated: true };
  }
}
