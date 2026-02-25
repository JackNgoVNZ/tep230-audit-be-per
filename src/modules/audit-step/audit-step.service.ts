import { AppDataSource } from '../../config/database';

export class AuditStepService {
  async startStep(code: string) {
    // 1. Fetch CHSI
    const rows = await AppDataSource.query(
      'SELECT code, mychpi, description FROM bp_chsi_checkstepitem WHERE code = ?',
      [code]
    );
    if (!rows.length) {
      throw { statusCode: 404, message: 'Step not found' };
    }
    const chsi = rows[0];

    // 2. Check if already started
    if (chsi.description && chsi.description.includes('[STARTED]')) {
      throw { statusCode: 400, message: 'Step already started' };
    }

    // 3. CASCADE: CHLI → 'Auditing' (all items in this step)
    await AppDataSource.query(
      "UPDATE bp_chli_checklistitem SET status = 'Auditing' WHERE mychsi = ? AND status != 'Audited'",
      [code]
    );

    // 4. CASCADE: CHSI → 'Auditing'
    await AppDataSource.query(
      "UPDATE bp_chsi_checkstepitem SET status = 'Auditing', description = CONCAT(IFNULL(description,''), ' [STARTED]') WHERE code = ?",
      [code]
    );

    // 5. CASCADE: CHPI → 'Auditing' (if not already Audited)
    await AppDataSource.query(
      "UPDATE bp_chpi_checkprocessitem SET status = 'Auditing' WHERE code = ? AND status != 'Audited'",
      [chsi.mychpi]
    );

    return { step_code: code, step_status: 'AUDITING' };
  }

  async completeStep(code: string) {
    // 1. Fetch CHSI
    const rows = await AppDataSource.query(
      'SELECT code, mychpi, description FROM bp_chsi_checkstepitem WHERE code = ?',
      [code]
    );
    if (!rows.length) {
      throw { statusCode: 404, message: 'Step not found' };
    }
    const chsi = rows[0];

    // 2. Check if started
    if (!chsi.description || !chsi.description.includes('[STARTED]')) {
      throw { statusCode: 400, message: 'Step has not been started' };
    }

    // 3. Check unscored CHLI
    const unscoredRows = await AppDataSource.query(
      'SELECT COUNT(*) as unscored FROM bp_chli_checklistitem WHERE mychsi = ? AND score1 IS NULL',
      [code]
    );
    const unscored = Number(unscoredRows[0].unscored);
    if (unscored > 0) {
      throw { statusCode: 400, message: `Not all items scored (${unscored} remaining)` };
    }

    // 4. Update step status to Audited and description with [COMPLETED]
    await AppDataSource.query(
      "UPDATE bp_chsi_checkstepitem SET status = 'Audited', description = REPLACE(description, '[STARTED]', '[COMPLETED]') WHERE code = ?",
      [code]
    );

    // 5. Update all CHLI items in this step to Audited
    await AppDataSource.query(
      "UPDATE bp_chli_checklistitem SET status = 'Audited' WHERE mychsi = ?",
      [code]
    );

    return { step_code: code, step_status: 'AUDITED' };
  }
}
