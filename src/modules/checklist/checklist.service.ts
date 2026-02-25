import { AppDataSource } from '../../config/database';
import { BatchUpdateInput } from './checklist.schema';

export class ChecklistService {
  async getChecklistsByStep(chsiCode: string) {
    const items = await AppDataSource.query(
      `SELECT
        chli.code, chli.name, chli.mychsi, chli.myparentchlt,
        chli.scoretype1, chli.score1,
        chli.\`do\`, chli.donot,
        COALESCE(parent_chlt.name, 'General') AS parent_name
       FROM bp_chli_checklistitem chli
       LEFT JOIN bp_chlt_checklisttemp parent_chlt ON parent_chlt.code = chli.myparentchlt
       WHERE chli.mychsi = ?
       ORDER BY chli.myparentchlt, chli.code ASC`,
      [chsiCode],
    );

    // Group by parent
    const groupMap = new Map<string, { group_name: string; items: any[] }>();
    for (const item of items) {
      const key = item.myparentchlt || 'root';
      if (!groupMap.has(key)) {
        groupMap.set(key, { group_name: item.parent_name, items: [] });
      }
      groupMap.get(key)!.items.push({
        chli_code: item.code,
        criteria_name: item.name,
        scoretype1: item.scoretype1,
        score1: item.score1,
        do: item.do,
        donot: item.donot,
      });
    }

    return { groups: Array.from(groupMap.values()) };
  }

  async batchUpdate(input: BatchUpdateInput) {
    // Batch verify: kiểm tra tất cả items tồn tại trong 1 query
    const codes = input.items.map(item => item.chli_code);
    const placeholders = codes.map(() => '?').join(',');
    const existingRows = await AppDataSource.query(
      `SELECT code FROM bp_chli_checklistitem WHERE code IN (${placeholders})`,
      codes,
    );
    const existingCodes = new Set(existingRows.map((r: any) => r.code));
    for (const code of codes) {
      if (!existingCodes.has(code)) {
        throw { statusCode: 404, message: `Checklist item not found: ${code}` };
      }
    }

    // Batch update: dùng CASE expression trong 1 query
    const scoreWhen = input.items.map(() => 'WHEN code = ? THEN ?').join(' ');
    const scoreParams: any[] = [];
    for (const item of input.items) {
      scoreParams.push(item.chli_code, String(item.score1));
    }

    // Build description (reason) CASE if any item has reason
    const hasReason = input.items.some(item => item.reason !== undefined);
    let descPart = '';
    const descParams: any[] = [];
    if (hasReason) {
      const descWhen = input.items.map(() => 'WHEN code = ? THEN ?').join(' ');
      for (const item of input.items) {
        descParams.push(item.chli_code, item.reason ?? '');
      }
      descPart = `, description = CASE ${descWhen} END`;
    }

    console.log('[batchUpdate] Updating CHLI codes:', codes, 'scoreParams:', scoreParams);
    await AppDataSource.query(
      `UPDATE bp_chli_checklistitem SET score1 = CASE ${scoreWhen} END${descPart}, status = CASE WHEN status != 'Audited' THEN 'Auditing' ELSE status END, updated_at = NOW() WHERE code IN (${placeholders})`,
      [...scoreParams, ...descParams, ...codes],
    );

    // CASCADE: CHLI → CHSI → CHPI status to 'Auditing'
    const chsiRows = await AppDataSource.query(
      `SELECT DISTINCT mychsi FROM bp_chli_checklistitem WHERE code IN (${placeholders})`,
      codes,
    );
    const chsiCodes = chsiRows.map((r: any) => r.mychsi).filter(Boolean);

    console.log('[batchUpdate] CASCADE: CHSI codes to update:', chsiCodes);
    if (chsiCodes.length > 0) {
      const chsiPlaceholders = chsiCodes.map(() => '?').join(',');
      await AppDataSource.query(
        `UPDATE bp_chsi_checkstepitem SET status = 'Auditing' WHERE code IN (${chsiPlaceholders}) AND status != 'Audited'`,
        chsiCodes,
      );

      const chpiRows = await AppDataSource.query(
        `SELECT DISTINCT mychpi FROM bp_chsi_checkstepitem WHERE code IN (${chsiPlaceholders})`,
        chsiCodes,
      );
      const chpiCodes = chpiRows.map((r: any) => r.mychpi).filter(Boolean);

      console.log('[batchUpdate] CASCADE: CHPI codes to update:', chpiCodes);
      if (chpiCodes.length > 0) {
        const chpiPlaceholders = chpiCodes.map(() => '?').join(',');
        await AppDataSource.query(
          `UPDATE bp_chpi_checkprocessitem SET status = 'Auditing' WHERE code IN (${chpiPlaceholders}) AND status != 'Audited'`,
          chpiCodes,
        );
      }
    }

    return { updated: input.items.length };
  }
}
