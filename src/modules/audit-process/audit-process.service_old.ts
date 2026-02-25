import { AppDataSource } from '../../config/database';
import { localQuery } from '../../config/local-query';
import { AppError } from '../../middleware/error-handler.middleware';
import { generateCode } from '../../common/utils/code-generator';
import { CreateAuditProcessInput } from './audit-process.schema';

export class AuditProcessService {
  /**
   * CASCADE creation: CHPI → CHSI → CHLI
   * 1. Find CHPT template
   * 2. Create CHPI instance from template
   * 3. Find all CHST (steps) for this CHPT
   * 4. Create CHSI instances for each CHST
   * 5. Find all CHLT (checklists) for each CHST
   * 6. Create CHLI instances for each CHLT
   * 7. Create audit_session_status record
   */
  async createAuditProcess(input: CreateAuditProcessInput, creatorCode: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify CHPT template exists
      const chptRows = await queryRunner.query(
        'SELECT * FROM bp_chpt_checkprocesstemp WHERE code = ? AND published = 1',
        [input.chptCode]
      );
      if (!chptRows.length) throw new AppError('Process template not found', 404);
      const chpt = chptRows[0];

      // 2. Create CHPI instance
      const chpiCode = `CHPI_${input.auditType}_${input.triggerUsiCode}_${Date.now().toString(36)}`;
      const chpiName = `${chpt.name} - ${input.triggerUsiCode}`;

      await queryRunner.query(
        `INSERT INTO bp_chpi_checkprocessitem
         (code, name, mychpt, mychpttype, mylcet, mycuievent, mytrigger, mychecker, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [chpiCode, chpiName, input.chptCode, input.auditType, chpt.mylcet || '',
         input.cuieCode || null, input.triggerUsiCode, input.checkerUsiCode || null]
      );

      // 3. Find all CHST steps for this CHPT
      const chstRows = await queryRunner.query(
        'SELECT * FROM bp_chst_checksteptemp WHERE mychpt = ? AND published = 1 ORDER BY id',
        [input.chptCode]
      );

      const createdSteps: any[] = [];
      const createdItems: any[] = [];

      for (let si = 0; si < chstRows.length; si++) {
        const chst = chstRows[si];

        // 4. Create CHSI instance
        const chsiCode = `${chpiCode}_S${String(si + 1).padStart(2, '0')}`;
        const chsiName = chst.name || `Step ${si + 1}`;

        await queryRunner.query(
          `INSERT INTO bp_chsi_checkstepitem
           (code, checksample, name, mychpi, mychri, mychst, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [chsiCode, String(chst.checksample || 1), chsiName, chpiCode,
           input.checkerUsiCode || null, chst.code]
        );
        createdSteps.push({ code: chsiCode, name: chsiName, chstCode: chst.code });

        // 5. Find all CHLT checklists for this CHST
        const chltRows = await queryRunner.query(
          'SELECT * FROM bp_chlt_checklisttemp WHERE mychst = ? AND published = 1 ORDER BY id',
          [chst.code]
        );

        for (let ci = 0; ci < chltRows.length; ci++) {
          const chlt = chltRows[ci];

          // 6. Create CHLI instance
          const chliCode = `${chsiCode}_I${String(ci + 1).padStart(3, '0')}`;

          await queryRunner.query(
            `INSERT INTO bp_chli_checklistitem
             (code, subcode, name, mychsi, myparentchlt, mysubchlt, scoretype1, score1, scoretype2, score2, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [chliCode, chlt.subcode || null, chlt.name, chsiCode,
             chlt.myparentchlt || chlt.code, chlt.code,
             chlt.scoretype || null, null, chlt.scoretype2 || null, null]
          );
          createdItems.push({ code: chliCode, name: chlt.name, chsiCode });
        }
      }

      await queryRunner.commitTransaction();

      // 7. Create audit_session_status (SQLite - outside MySQL transaction)
      await localQuery(
        `INSERT INTO audit_session_status
         (chpi_code, audit_type, status, created_at)
         VALUES (?, ?, 'PENDING', datetime('now'))`,
        [chpiCode, input.auditType]
      );

      return {
        chpiCode,
        chpiName,
        auditType: input.auditType,
        triggerUsi: input.triggerUsiCode,
        stepsCreated: createdSteps.length,
        itemsCreated: createdItems.length,
        steps: createdSteps,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * List audit processes with pagination and filters
   */
  async listProcesses(page: number, limit: number, auditType?: string, status?: string) {
    // Step 1: Query audit_session_status from SQLite with filters
    const assParams: any[] = [];
    let assWhere = 'WHERE 1=1';

    if (auditType) {
      assWhere += ' AND audit_type = ?';
      assParams.push(auditType);
    }
    if (status) {
      assWhere += ' AND status = ?';
      assParams.push(status);
    }

    const allSessions: any[] = await localQuery(
      `SELECT chpi_code, audit_type, status, total_score, threshold_result,
              assigned_at, started_at, completed_at
       FROM audit_session_status ${assWhere}`,
      assParams
    );

    if (!allSessions.length) return { data: [], total: 0 };

    const chpiCodes = allSessions.map((s: any) => s.chpi_code);
    const sessionMap = new Map(allSessions.map((s: any) => [s.chpi_code, s]));

    // Step 2: Query bp_chpi + bp_usi from MySQL
    const placeholders = chpiCodes.map(() => '?').join(',');
    const offset = (page - 1) * limit;

    const data = await AppDataSource.query(
      `SELECT
        chpi.id, chpi.code, chpi.name, chpi.mychpt, chpi.mychpttype as audit_type,
        chpi.mytrigger as gv_code, chpi.mychecker as auditor_code,
        chpi.mycuievent, chpi.created_at,
        usi_gv.fullname as gv_name, usi_gv.email as gv_email,
        usi_aud.fullname as auditor_name
       FROM bp_chpi_checkprocessitem chpi
       LEFT JOIN bp_usi_useritem usi_gv ON usi_gv.code = chpi.mytrigger
       LEFT JOIN bp_usi_useritem usi_aud ON usi_aud.code = chpi.mychecker
       WHERE chpi.code IN (${placeholders})
       ORDER BY chpi.created_at DESC
       LIMIT ? OFFSET ?`,
      [...chpiCodes, limit, offset]
    );

    // Step 3: Merge in JS
    const merged = data.map((row: any) => {
      const session = sessionMap.get(row.code) || {};
      return { ...row, ...session };
    });

    return { data: merged, total: chpiCodes.length };
  }

  /**
   * Get audit process detail with steps and checklist items
   */
  async getProcessDetail(chpiCode: string) {
    // Step 1: Query CHPI + USI from MySQL
    const processRows = await AppDataSource.query(
      `SELECT chpi.*,
              usi_gv.fullname as gv_name, usi_gv.email as gv_email, usi_gv.phone as gv_phone,
              usi_aud.fullname as auditor_name
       FROM bp_chpi_checkprocessitem chpi
       LEFT JOIN bp_usi_useritem usi_gv ON usi_gv.code = chpi.mytrigger
       LEFT JOIN bp_usi_useritem usi_aud ON usi_aud.code = chpi.mychecker
       WHERE chpi.code = ?`,
      [chpiCode]
    );

    if (!processRows.length) throw new AppError('Audit process not found', 404);

    // Step 2: Query audit_session_status from SQLite
    const assRows: any[] = await localQuery(
      `SELECT status, total_score, threshold_result, audit_type,
              assigned_at, started_at, completed_at
       FROM audit_session_status WHERE chpi_code = ?`,
      [chpiCode]
    );
    const ass = assRows[0] || {};

    // Step 3: Merge
    const process = { ...processRows[0], ...ass };

    const steps = await AppDataSource.query(
      `SELECT chsi.*, usi.fullname as checker_name
       FROM bp_chsi_checkstepitem chsi
       LEFT JOIN bp_usi_useritem usi ON usi.code = chsi.mychri
       WHERE chsi.mychpi = ? ORDER BY chsi.id`,
      [chpiCode]
    );

    for (const step of steps) {
      step.checklists = await AppDataSource.query(
        `SELECT * FROM bp_chli_checklistitem WHERE mychsi = ? ORDER BY id`,
        [step.code]
      );
    }

    return { process, steps };
  }

  /**
   * Assign auditor to process
   */
  async assignAuditor(chpiCode: string, checkerUsiCode: string) {
    // MySQL: update bp_chpi and bp_chsi
    await AppDataSource.query(
      'UPDATE bp_chpi_checkprocessitem SET mychecker = ?, updated_at = NOW() WHERE code = ?',
      [checkerUsiCode, chpiCode]
    );
    await AppDataSource.query(
      'UPDATE bp_chsi_checkstepitem SET mychri = ?, updated_at = NOW() WHERE mychpi = ?',
      [checkerUsiCode, chpiCode]
    );
    // SQLite: update audit_session_status
    await localQuery(
      `UPDATE audit_session_status SET status = 'ASSIGNED', assigned_at = datetime('now'), updated_at = datetime('now')
       WHERE chpi_code = ?`,
      [chpiCode]
    );
    return { chpiCode, assignedTo: checkerUsiCode };
  }

  /**
   * Delete/cancel audit process
   */
  async cancelProcess(chpiCode: string) {
    await localQuery(
      `UPDATE audit_session_status SET status = 'CANCELLED', updated_at = datetime('now') WHERE chpi_code = ?`,
      [chpiCode]
    );
    return { chpiCode, status: 'CANCELLED' };
  }
}
