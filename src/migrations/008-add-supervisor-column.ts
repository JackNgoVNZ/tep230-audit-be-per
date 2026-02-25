import { localQuery } from '../config/local-query';

export async function up() {
  const cols = await localQuery(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_session_status' AND COLUMN_NAME = 'supervisor_code'`
  );
  if (cols.length === 0) {
    await localQuery(
      `ALTER TABLE audit_session_status ADD COLUMN supervisor_code VARCHAR(128) NULL AFTER scheduled_date`
    );
  }
}

export async function down() {
  await localQuery(
    `ALTER TABLE audit_session_status DROP COLUMN supervisor_code`
  );
}
