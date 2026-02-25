const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql.clevai.vn',
    user: 'aiagent',
    password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM',
    database: 'staging_s2_bp_log_v2',
  });

  try {
    // 1. Check bp_usi_useritem columns for settlement date
    console.log('=== 1. bp_usi_useritem columns ===');
    const [usiCols] = await conn.query('DESCRIBE bp_usi_useritem');
    usiCols.forEach(c => console.log(`  ${c.Field} (${c.Type})`));

    // 2. Check distinct mylcet_lceventtype values
    console.log('\n=== 2. Distinct event types (top 20) ===');
    const [evTypes] = await conn.query('SELECT mylcet_lceventtype, COUNT(*) as cnt FROM staging_s2_parent_report_db.bp_cuie_details GROUP BY mylcet_lceventtype ORDER BY cnt DESC LIMIT 20');
    evTypes.forEach(r => console.log(`  ${r.mylcet_lceventtype}: ${r.cnt}`));

    // 3. Check bp_vcr_meeting table (video links)
    console.log('\n=== 3. bp_vcr_meeting columns ===');
    try {
      const [vcrCols] = await conn.query('DESCRIBE bp_vcr_meeting');
      vcrCols.forEach(c => console.log(`  ${c.Field} (${c.Type})`));
    } catch (e) {
      console.log('  Table not found, trying staging_s2_parent_report_db...');
      try {
        const [vcrCols2] = await conn.query('DESCRIBE staging_s2_parent_report_db.bp_vcr_meeting');
        vcrCols2.forEach(c => console.log(`  ${c.Field} (${c.Type})`));
      } catch (e2) {
        console.log('  bp_vcr_meeting not found in either DB');
      }
    }

    // 4. Sample video data for a teacher
    console.log('\n=== 4. Sample bp_vcr_meeting data ===');
    try {
      const [vcrData] = await conn.query("SELECT * FROM bp_vcr_meeting LIMIT 3");
      vcrData.forEach(r => console.log(JSON.stringify(r)));
    } catch(e) {
      try {
        const [vcrData2] = await conn.query("SELECT * FROM staging_s2_parent_report_db.bp_vcr_meeting LIMIT 3");
        vcrData2.forEach(r => console.log(JSON.stringify(r)));
      } catch(e2) {
        console.log('  No bp_vcr_meeting data accessible');
      }
    }

    // 5. Check for settlement/settle columns in USI
    console.log('\n=== 5. USI columns with date/settle ===');
    const [settleCheck] = await conn.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'bp_usi_useritem' AND (COLUMN_NAME LIKE '%settle%' OR COLUMN_NAME LIKE '%date%' OR COLUMN_NAME LIKE '%created%' OR COLUMN_NAME LIKE '%start%')");
    settleCheck.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));

    // 6. Full row of bp_cuie_details for a JSU event to see all fields
    console.log('\n=== 6. Full bp_cuie_details row (JSU event) ===');
    const [fullRow] = await conn.query("SELECT * FROM staging_s2_parent_report_db.bp_cuie_details WHERE mylcet_lceventtype = 'DR-JN-JSU' AND mylck = 'GE' LIMIT 1");
    if (fullRow.length) {
      const r = fullRow[0];
      Object.keys(r).forEach(k => console.log(`  ${k}: ${r[k]}`));
    }

    // 7. Check if there's a "settle" event type (like teacher settlement/onboarding completion)
    console.log('\n=== 7. Event types containing settle/onboard/new ===');
    const [settleEvents] = await conn.query("SELECT DISTINCT mylcet_lceventtype FROM staging_s2_parent_report_db.bp_cuie_details WHERE mylcet_lceventtype LIKE '%SETTLE%' OR mylcet_lceventtype LIKE '%ONBOARD%' OR mylcet_lceventtype LIKE '%NEW%'");
    if (settleEvents.length === 0) console.log('  No settle/onboard/new event types found');
    else settleEvents.forEach(r => console.log(`  ${r.mylcet_lceventtype}`));

    // 8. Look for any table with "settle" in the name
    console.log('\n=== 8. Tables with settle in name ===');
    const [settleTables] = await conn.query("SHOW TABLES LIKE '%settle%'");
    if (settleTables.length === 0) console.log('  No tables with settle in name');
    else settleTables.forEach(r => console.log(`  ${Object.values(r)[0]}`));

    const [settleTables2] = await conn.query("SHOW TABLES FROM staging_s2_parent_report_db LIKE '%settle%'");
    if (settleTables2.length === 0) console.log('  No tables in parent_report_db with settle');
    else settleTables2.forEach(r => console.log(`  ${Object.values(r)[0]}`));

    // 9. Check value1 and value2 content in cuie_details (might contain URLs)
    console.log('\n=== 9. Sample value1/value2 from bp_cuie_details ===');
    const [vals] = await conn.query("SELECT DISTINCT value1, value2 FROM staging_s2_parent_report_db.bp_cuie_details WHERE value1 IS NOT NULL AND value1 != '' LIMIT 10");
    vals.forEach(r => console.log(`  value1=${r.value1}, value2=${r.value2}`));

    // 10. Check video module source code
    console.log('\n=== 10. Video link column in bp_vcr_meeting or related ===');
    const [videoTables] = await conn.query("SHOW TABLES LIKE '%vcr%'");
    videoTables.forEach(r => console.log(`  ${Object.values(r)[0]}`));
    const [videoTables2] = await conn.query("SHOW TABLES LIKE '%video%'");
    videoTables2.forEach(r => console.log(`  ${Object.values(r)[0]}`));

    console.log('\n--- DONE ---');
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
