import { AppDataSource } from '../config/database';

export async function cleanupOldData(): Promise<{ found: number }> {
  // Find CHPI records older than 6 months (log only, no deletion for safety)
  const oldRows = await AppDataSource.query(
    "SELECT code AS chpi_code, mychpttype AS audit_type, status, created_at FROM bp_chpi_checkprocessitem WHERE created_at <= DATE_SUB(NOW(), INTERVAL 6 MONTH)",
  );

  if (!oldRows || oldRows.length === 0) {
    console.log(`[CleanupOldData] Done — date: ${new Date().toISOString().slice(0, 10)}, found: 0`);
    return { found: 0 };
  }

  for (const row of oldRows) {
    console.log(`[CleanupOldData] Old session: ${row.chpi_code} (${row.audit_type}, ${row.status}, created: ${row.created_at})`);
  }

  console.log(`[CleanupOldData] Done — date: ${new Date().toISOString().slice(0, 10)}, found: ${oldRows.length}`);
  return { found: oldRows.length };
}
