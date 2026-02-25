import { AppDataSource } from '../config/database';

export async function migrate011() {
  console.log('[Migration 011] Adding myulc, myclag columns to bp_chpi_checkprocessitem...');

  await AppDataSource.query(`
    ALTER TABLE bp_chpi_checkprocessitem
      ADD COLUMN myulc VARCHAR(128) DEFAULT NULL,
      ADD COLUMN myclag VARCHAR(128) DEFAULT NULL
  `);

  console.log('[Migration 011] Done — myulc, myclag columns added to CHPI');
}
