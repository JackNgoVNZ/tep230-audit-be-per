import { localQuery } from '../config/local-query';

export async function up() {
  // Check if column already exists
  const cols = await localQuery(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_session_status' AND COLUMN_NAME = 'scheduled_date'`
  );
  if (cols.length === 0) {
    await localQuery(
      `ALTER TABLE audit_session_status ADD COLUMN scheduled_date DATETIME NULL AFTER completed_at`
    );
  }
}

export async function down() {
  await localQuery(
    `ALTER TABLE audit_session_status DROP COLUMN scheduled_date`
  );
}
