import { AppDataSource } from '../config/database';
import { AuditProcessService } from '../modules/audit-process/audit-process.service';
import { GvFilterService } from '../modules/gv-filter/gv-filter.service';

/**
 * Cron job: extract onboard candidates from bp_cuie_details and create full audit processes.
 * Queries cross-database cuie_details directly (runs in background, not at API request time).
 * For each new first-JSU teacher → createAuditProcess() → CHPI + CHSI + CHLI + audit_session_status(PENDING).
 */
export async function syncOnboardGv(options?: { dateFrom?: string; dateTo?: string }): Promise<{ created: number; skipped: number }> {
  const auditService = new AuditProcessService();
  const VALID_LCK = GvFilterService.VALID_LCK;
  const lckPlaceholders = VALID_LCK.map(() => '?').join(',');

  // Optional date range filter on trigger_at
  let dateCondition = '';
  const params: any[] = [...VALID_LCK];
  if (options?.dateFrom) {
    dateCondition += ' AND d.trigger_at >= ?';
    params.push(options.dateFrom);
  }
  if (options?.dateTo) {
    dateCondition += ' AND d.trigger_at < DATE_ADD(?, INTERVAL 1 DAY)';
    params.push(options.dateTo);
  }

  // Query bp_cuie_details for first-JSU teachers (shift_index=1) with valid LCK,
  // excluding those who already have an ONBOARD CHPI.
  const candidateSql = `
    SELECT
      d.myusi          AS usi_code,
      d.mycuie         AS first_jsu_cuie_code
    FROM staging_s2_parent_report_db.bp_cuie_details d
    WHERE d.mylcet_lceventtype = 'DR-JN-JSU'
      AND d.shift_index = 1
      AND d.reporting_period_my_ust = 'TE'
      AND d.mylck IN (${lckPlaceholders})
      AND NOT EXISTS (
        SELECT 1 FROM bp_chpi_checkprocessitem chpi
        WHERE chpi.mytrigger = d.myusi AND chpi.mychpttype = 'ONB-AUDIT'
      )
      ${dateCondition}
    ORDER BY d.trigger_at ASC
    LIMIT 500
  `;

  const candidates = await AppDataSource.query(candidateSql, params);

  let created = 0;
  let skipped = 0;

  for (const gv of candidates) {
    try {
      await auditService.createAuditProcess({
        cuie_code: gv.first_jsu_cuie_code,
        audit_type: 'ONB-AUDIT',
        trigger_usi_code: gv.usi_code,
      });
      created++;
    } catch (err: any) {
      skipped++;
      console.warn(`[SyncOnboardGV] Skipped GV ${gv.usi_code}: ${err.message || err}`);
    }
  }

  console.log(`[SyncOnboardGV] Done — date: ${new Date().toISOString().slice(0, 10)}, onboard_created: ${created}, skipped: ${skipped}`);
  return { created, skipped };
}
