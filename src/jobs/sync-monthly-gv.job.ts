import { AppDataSource } from '../config/database';
import { GvFilterService } from '../modules/gv-filter/gv-filter.service';
import { AuditProcessService } from '../modules/audit-process/audit-process.service';

export async function syncMonthlyGv(): Promise<{ inherited: number; created: number; skipped: number }> {
  const gvService = new GvFilterService();
  const auditService = new AuditProcessService();

  // 1. Resolve current month CAP code
  const capRows = await AppDataSource.query(
    "SELECT code FROM bp_cap_calendarperiod WHERE startperiod <= NOW() AND endperiod >= NOW() AND captype = 'CAMN' LIMIT 1",
  );
  if (!capRows || capRows.length === 0) {
    console.warn('[SyncMonthlyGV] No CAP month found for current date, skipping');
    return { inherited: 0, created: 0, skipped: 0 };
  }
  const capCode = capRows[0].code;

  // 2. Get all candidates (INHERIT_WEEKLY + NEW_AUDIT)
  const result = await gvService.filterMonthly(capCode, 1, 500);
  const candidates = result.data;

  let inherited = 0;
  let created = 0;
  let skipped = 0;

  for (const gv of candidates) {
    if (gv.source === 'INHERIT_WEEKLY') {
      // Already has a WEEKLY audit session — count as inherited, no new CHPI needed
      inherited++;
      continue;
    }

    // NEW_AUDIT — create MONTHLY audit process
    try {
      await auditService.createAuditProcess({
        cuie_code: gv.selected_cuie_code,
        audit_type: 'MTL-AUDIT',
        trigger_usi_code: gv.usi_code,
      });
      created++;
    } catch (err: any) {
      skipped++;
      console.warn(`[SyncMonthlyGV] Skipped GV ${gv.usi_code}: ${err.message || err}`);
    }
  }

  console.log(`[SyncMonthlyGV] Done — date: ${new Date().toISOString().slice(0, 10)}, inherited: ${inherited}, monthly_created: ${created}, skipped: ${skipped}`);
  return { inherited, created, skipped };
}
