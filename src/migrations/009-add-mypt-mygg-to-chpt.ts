import { AppDataSource } from '../config/database';

export async function up() {
  // 1a. Add mypt column if not exists
  const myptCols = await AppDataSource.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'bp_chpt_checkprocesstemp'
     AND COLUMN_NAME = 'mypt'`
  );
  if (myptCols.length === 0) {
    await AppDataSource.query(
      `ALTER TABLE bp_chpt_checkprocesstemp ADD COLUMN mypt VARCHAR(128) NULL AFTER code`
    );
  }

  // 1b. Add mygg column if not exists
  const myggCols = await AppDataSource.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'bp_chpt_checkprocesstemp'
     AND COLUMN_NAME = 'mygg'`
  );
  if (myggCols.length === 0) {
    await AppDataSource.query(
      `ALTER TABLE bp_chpt_checkprocesstemp ADD COLUMN mygg VARCHAR(128) NULL AFTER mypt`
    );
  }

  // 2. Insert LCET record for AuditVideo (if not exists)
  const existing = await AppDataSource.query(
    `SELECT code FROM bp_lcet_learningcomponenteventtype WHERE code = 'AF-FL-ADV'`
  );
  if (existing.length === 0) {
    await AppDataSource.query(
      `INSERT INTO bp_lcet_learningcomponenteventtype (code, name, myparent, level, created_at)
       VALUES ('AF-FL-ADV', 'AuditVideo', 'AF-FL', '3', NOW())`
    );
  }
}

export async function down() {
  // Remove added columns
  await AppDataSource.query(
    `ALTER TABLE bp_chpt_checkprocesstemp DROP COLUMN IF EXISTS mypt`
  );
  await AppDataSource.query(
    `ALTER TABLE bp_chpt_checkprocesstemp DROP COLUMN IF EXISTS mygg`
  );
  // Remove LCET record
  await AppDataSource.query(
    `DELETE FROM bp_lcet_learningcomponenteventtype WHERE code = 'AF-FL-ADV'`
  );
}
