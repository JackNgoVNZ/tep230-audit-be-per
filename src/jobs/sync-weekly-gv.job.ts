import { AppDataSource } from '../config/database';
import { GvFilterService } from '../modules/gv-filter/gv-filter.service';
import { AuditProcessService } from '../modules/audit-process/audit-process.service';

export async function syncWeeklyGv(): Promise<{ created: number; skipped: number }> {
  const gvService = new GvFilterService();
  const auditService = new AuditProcessService();

  // 1. Resolve current week CAP code
  const capRows = await AppDataSource.query(
    "SELECT code FROM bp_cap_calendarperiod WHERE startperiod <= NOW() AND endperiod >= NOW() AND captype = 'CAWK' LIMIT 1",
  );
  if (!capRows || capRows.length === 0) {
    console.warn('[SyncWeeklyGV] No CAP week found for current date, skipping');
    return { created: 0, skipped: 0 };
  }
  const capCode = capRows[0].code;

  // 2. Get eligible GVs (~10% random, already excludes existing WEEKLY)
  const result = await gvService.filterWeekly(capCode, 1, 500);
  const candidates = result.data;

  let created = 0;
  let skipped = 0;

  for (const gv of candidates) {
    try {
      await auditService.createAuditProcess({
        cuie_code: gv.selected_cuie_code,
        audit_type: 'WKL-AUDIT',
        trigger_usi_code: gv.usi_code,
      });
      created++;
    } catch (err: any) {
      skipped++;
      console.warn(`[SyncWeeklyGV] Skipped GV ${gv.usi_code}: ${err.message || err}`);
    }
  }

  console.log(`[SyncWeeklyGV] Done — date: ${new Date().toISOString().slice(0, 10)}, weekly_created: ${created}, skipped: ${skipped}`);
  return { created, skipped };
}
