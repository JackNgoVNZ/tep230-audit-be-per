import { AppDataSource } from '../config/database';

const TABLES = [
  'bp_chpi_checkprocessitem',
  'bp_chsi_checkstepitem',
  'bp_chli_checklistitem',
];

export async function up() {
  for (const table of TABLES) {
    const cols = await AppDataSource.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = 'status'`,
      [table],
    );
    if (cols.length === 0) {
      await AppDataSource.query(
        `ALTER TABLE ${table} ADD COLUMN status VARCHAR(32) NULL`,
      );
    }
  }
}

export async function down() {
  for (const table of TABLES) {
    await AppDataSource.query(
      `ALTER TABLE ${table} DROP COLUMN IF EXISTS status`,
    );
  }
}
