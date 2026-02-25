import { AppDataSource } from '../config/database';
import { AuditorAssignmentService } from '../modules/auditor-assignment/auditor-assignment.service';

export async function autoAssignAuditor(): Promise<{ assigned: number; skipped: number }> {
  // 1. Find unassigned CHPI records (no checker assigned, no status)
  const pendingRows = await AppDataSource.query(
    "SELECT code AS chpi_code FROM bp_chpi_checkprocessitem WHERE mychecker IS NULL AND status = 'Open'",
  );

  if (!pendingRows || pendingRows.length === 0) {
    console.log(`[AutoAssignAuditor] Done — date: ${new Date().toISOString().slice(0, 10)}, auto_assigned: 0, skipped: 0`);
    return { assigned: 0, skipped: 0 };
  }

  const chpiCodes = pendingRows.map((r: any) => r.chpi_code);

  // 2. Use existing round-robin assignment service
  const service = new AuditorAssignmentService();
  const result = await service.randomAssign(chpiCodes);

  const assigned = result.assigned.length;
  const skipped = result.skipped.length;

  console.log(`[AutoAssignAuditor] Done — date: ${new Date().toISOString().slice(0, 10)}, auto_assigned: ${assigned}, skipped: ${skipped}`);
  return { assigned, skipped };
}
