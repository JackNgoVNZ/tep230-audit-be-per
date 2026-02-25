import { AppDataSource } from '../config/database';

/**
 * Normalize status values across CHPI, CHSI, CHLI tables.
 * Old values → New standard:
 *   'In Progress' → 'Auditing'
 *   'Completed'   → 'Audited'
 *   NULL          → 'Open'
 */
const TABLES = [
  'bp_chpi_checkprocessitem',
  'bp_chsi_checkstepitem',
  'bp_chli_checklistitem',
];

export async function up() {
  for (const table of TABLES) {
    await AppDataSource.query(
      `UPDATE ${table} SET status = 'Auditing' WHERE status = 'In Progress'`,
    );
    await AppDataSource.query(
      `UPDATE ${table} SET status = 'Audited' WHERE status = 'Completed'`,
    );
    await AppDataSource.query(
      `UPDATE ${table} SET status = 'Open' WHERE status IS NULL`,
    );
  }
}

export async function down() {
  // Reverse mapping (best-effort)
  for (const table of TABLES) {
    await AppDataSource.query(
      `UPDATE ${table} SET status = 'In Progress' WHERE status = 'Auditing'`,
    );
    await AppDataSource.query(
      `UPDATE ${table} SET status = 'Completed' WHERE status = 'Audited'`,
    );
  }
}
