const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: 'mysql.clevai.vn', user: 'aiagent', password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM', database: 'staging_s2_bp_log_v2' });

  // Find all FK references to bp_chpt_checkprocesstemp
  const [fks] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_SCHEMA = 'staging_s2_bp_log_v2'
      AND REFERENCED_TABLE_NAME = 'bp_chpt_checkprocesstemp'
    ORDER BY TABLE_NAME
  `);
  console.log('FK references to bp_chpt_checkprocesstemp:');
  fks.forEach(r => console.log(`  ${r.TABLE_NAME}.${r.COLUMN_NAME} -> ${r.REFERENCED_TABLE_NAME}.${r.REFERENCED_COLUMN_NAME} (${r.CONSTRAINT_NAME})`));

  // Check which of those tables have rows referencing our 10 codes
  const codes = ['KMA_TT_8-G3','KMA_TT_8-G4','KMA_TT_8-G5','KMA_TT_8-G6','KMA_TT_8-G7','KMA_TT_8-G8','KMA_TT_8-G9','KMA_TT_8-G10','KMA_TT_8-G11','KMA_TT_8-G12'];
  const ph = codes.map(() => '?').join(',');

  for (const fk of fks) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) as cnt FROM \`${fk.TABLE_NAME}\` WHERE \`${fk.COLUMN_NAME}\` IN (${ph})`,
      codes
    );
    if (rows[0].cnt > 0) {
      console.log(`\n  *** ${fk.TABLE_NAME}.${fk.COLUMN_NAME}: ${rows[0].cnt} rows referencing old CHPT codes!`);
    }
  }

  await conn.end();
})().catch(e => console.error(e));
