const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql.clevai.vn',
    user: 'aiagent',
    password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM',
    database: 'staging_s2_bp_log_v2',
  });

  console.log('=== 1. Distinct mylck values from bp_cuie_details WHERE mypt = KMA_TT_8 ===');
  const [rows1] = await conn.query(`
    SELECT DISTINCT mylck, COUNT(*) as cnt 
    FROM staging_s2_parent_report_db.bp_cuie_details 
    WHERE mypt = 'KMA_TT_8' 
    GROUP BY mylck 
    ORDER BY cnt DESC
  `);
  console.table(rows1);

  console.log('\n=== 2. Specific users cuie events from bp_cuie_details ===');
  const [rows2] = await conn.query(`
    SELECT mycuie, myusi, mypt, mygg, mylck, mylct 
    FROM staging_s2_parent_report_db.bp_cuie_details 
    WHERE myusi IN ('anhnvn', 'anhnm', 'thopt', 'anhdt8')
    ORDER BY myusi, mycuie
  `);
  console.table(rows2);

  console.log('\n=== 3. All distinct mylck across entire bp_cuie_details ===');
  const [rows3] = await conn.query(`
    SELECT DISTINCT mylck, COUNT(*) as cnt 
    FROM staging_s2_parent_report_db.bp_cuie_details 
    GROUP BY mylck 
    ORDER BY cnt DESC
  `);
  console.table(rows3);

  console.log('\n=== 4. CHPT codes matching KMA_TT_8-% (from staging_s2_bp_log_v2) ===');
  const [rows4] = await conn.query(`
    SELECT code, name 
    FROM bp_chpt_checkprocesstemp 
    WHERE code LIKE 'KMA_TT_8-%'
    ORDER BY code
  `);
  console.table(rows4);
  console.log(`Total CHPT codes matching KMA_TT_8-%: ${rows4.length}`);

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
