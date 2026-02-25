import 'dotenv/config';
import { DataSource } from 'typeorm';

const ds = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'aiagent',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'staging_s2_bp_log_v2',
  logging: false,
});

async function main() {
  await ds.initialize();
  const w = (s: string) => process.stdout.write(s + '\n');

  await ds.query('SET FOREIGN_KEY_CHECKS = 0');
  w('FK checks disabled');

  let r: any;

  // CHLI
  r = await ds.query("UPDATE bp_chli_checklistitem SET mychsi = REPLACE(mychsi, 'CHPI_Onboard Audit_', 'CHPI_ONBOARDAUDIT_') WHERE mychsi LIKE '%CHPI_Onboard Audit_%'");
  w('CHLI mychsi: ' + r.affectedRows);
  r = await ds.query("UPDATE bp_chli_checklistitem SET code = REPLACE(code, 'CHPI_Onboard Audit_', 'CHPI_ONBOARDAUDIT_') WHERE code LIKE '%CHPI_Onboard Audit_%'");
  w('CHLI code: ' + r.affectedRows);

  // CHSI
  r = await ds.query("UPDATE bp_chsi_checkstepitem SET code = REPLACE(code, 'CHPI_Onboard Audit_', 'CHPI_ONBOARDAUDIT_') WHERE code LIKE '%CHPI_Onboard Audit_%'");
  w('CHSI code: ' + r.affectedRows);
  r = await ds.query("UPDATE bp_chsi_checkstepitem SET mychpi = REPLACE(mychpi, 'CHPI_Onboard Audit_', 'CHPI_ONBOARDAUDIT_') WHERE mychpi LIKE 'CHPI_Onboard Audit_%'");
  w('CHSI mychpi: ' + r.affectedRows);

  // CHPI
  r = await ds.query("UPDATE bp_chpi_checkprocessitem SET code = REPLACE(code, 'CHPI_Onboard Audit_', 'CHPI_ONBOARDAUDIT_') WHERE code LIKE 'CHPI_Onboard Audit_%'");
  w('CHPI code (pattern1): ' + r.affectedRows);
  r = await ds.query("UPDATE bp_chpi_checkprocessitem SET code = REPLACE(code, 'CHPI_ONBOARD_', 'CHPI_ONBOARDAUDIT_') WHERE code LIKE 'CHPI_ONBOARD_%'");
  w('CHPI code (pattern2): ' + r.affectedRows);
  r = await ds.query("UPDATE bp_chpi_checkprocessitem SET mychpttype = 'ONBOARDAUDIT' WHERE mychpttype IN ('Onboard Audit', 'ONBOARD')");
  w('CHPI mychpttype: ' + r.affectedRows);

  await ds.query('SET FOREIGN_KEY_CHECKS = 1');
  w('FK checks re-enabled');

  // Verify
  const v1 = await ds.query('SELECT code, mychpttype, status FROM bp_chpi_checkprocessitem');
  w('\n=== VERIFY CHPI ===\n' + JSON.stringify(v1, null, 2));
  const v2 = await ds.query('SELECT code, mychpi FROM bp_chsi_checkstepitem LIMIT 3');
  w('\n=== VERIFY CHSI ===\n' + JSON.stringify(v2, null, 2));
  const v3 = await ds.query('SELECT code, mychsi FROM bp_chli_checklistitem LIMIT 3');
  w('\n=== VERIFY CHLI ===\n' + JSON.stringify(v3, null, 2));

  await ds.destroy();
  w('\nDone!');
}

main().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
