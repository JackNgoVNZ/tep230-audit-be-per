import { GvFilterService } from '../modules/gv-filter/gv-filter.service';
import { AuditProcessService } from '../modules/audit-process/audit-process.service';

export async function syncHotcaseGv(): Promise<{ created: number; skipped: number }> {
  const gvService = new GvFilterService();
  const auditService = new AuditProcessService();

  // Get unprocessed HOT events (already excludes events with existing HOTCASE audit)
  const result = await gvService.filterHotcase(1, 500);
  const candidates = result.data;

  let created = 0;
  let skipped = 0;

  for (const event of candidates) {
    try {
      await auditService.createAuditProcess({
        cuie_code: event.cuie_code,
        audit_type: 'HOT-AUDIT',
        trigger_usi_code: event.usi_code,
      });
      created++;
    } catch (err: any) {
      skipped++;
      console.warn(`[SyncHotcaseGV] Skipped HOT event ${event.cuie_code}: ${err.message || err}`);
    }
  }

  console.log(`[SyncHotcaseGV] Done — date: ${new Date().toISOString().slice(0, 10)}, hotcase_created: ${created}, skipped: ${skipped}`);
  return { created, skipped };
}
