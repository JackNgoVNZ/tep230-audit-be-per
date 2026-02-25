const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: 'mysql.clevai.vn', user: 'aiagent', password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM', database: 'staging_s2_bp_log_v2' });

  // Check cuie_details columns
  const [cols] = await conn.query("SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'staging_s2_parent_report_db' AND TABLE_NAME = 'bp_cuie_details' ORDER BY ORDINAL_POSITION");
  console.log('bp_cuie_details columns:');
  cols.forEach(c => console.log(' ', c.COLUMN_NAME, c.DATA_TYPE));

  // Sample data
  const [sample] = await conn.query('SELECT * FROM staging_s2_parent_report_db.bp_cuie_details LIMIT 3');
  console.log('\nSample rows:');
  sample.forEach(r => console.log(JSON.stringify(r)));

  // Check distinct mylct values
  const [lcts] = await conn.query('SELECT DISTINCT mylct FROM staging_s2_parent_report_db.bp_cuie_details ORDER BY mylct LIMIT 30');
  console.log('\nDistinct mylct values:');
  lcts.forEach(r => console.log(' ', r.mylct));

  await conn.end();
})().catch(e => console.error(e));
