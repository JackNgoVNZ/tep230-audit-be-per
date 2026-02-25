const mysql = require('mysql2/promise');

// Restore G8 CHST + CHLT by copying from the template structure we know
// G8 had 12 steps (P1,P4,P6-P15) with specific names
// The CHST/CHLT data was backed up in the previous rename scripts

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql.clevai.vn',
    user: 'aiagent',
    password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM',
    database: 'staging_s2_bp_log_v2',
  });

  try {
    const MYCHPT = 'KMA_TT_8-G8-GE';

    // Check current state
    const [existing] = await conn.query(
      'SELECT COUNT(*) as cnt FROM bp_chst_checksteptemp WHERE mychpt = ?', [MYCHPT]
    );
    console.log(`Current CHST under ${MYCHPT}: ${existing[0].cnt}`);

    if (existing[0].cnt > 0) {
      console.log('Already has CHST data, skipping.');
      await conn.end();
      return;
    }

    // G8 CHST data (12 steps with known names and codes)
    const chstData = [
      { code: 'KMA_TT_8-G8-P1', name: 'Page 1' },
      { code: 'KMA_TT_8-G8-P4', name: 'Page 4' },
      { code: 'KMA_TT_8-G8-P6', name: 'Page 6' },
      { code: 'KMA_TT_8-G8-P7', name: 'Page 7' },
      { code: 'KMA_TT_8-G8-P8', name: 'Page 8' },
      { code: 'KMA_TT_8-G8-P9', name: 'Page 9' },
      { code: 'KMA_TT_8-G8-P10', name: 'Page 10' },
      { code: 'KMA_TT_8-G8-P11', name: 'Page 11' },
      { code: 'KMA_TT_8-G8-P12', name: 'Page 12' },
      { code: 'KMA_TT_8-G8-P13', name: 'Page 13' },
      { code: 'KMA_TT_8-G8-P14', name: 'Page 14' },
      { code: 'KMA_TT_8-G8-P15', name: 'Page 15' },
    ];

    // G8 CHLT data (32 items with known names)
    const chltData = [
      { code: 'KMA_TT_8-G8-P1-1', name: '1.1 - Hoi ca lop', mychst: 'KMA_TT_8-G8-P1' },
      { code: 'KMA_TT_8-G8-P4-1', name: '4.1 - Bao cao - BTVN', mychst: 'KMA_TT_8-G8-P4' },
      { code: 'KMA_TT_8-G8-P6-1', name: '6.1 - Goi HS-Doc', mychst: 'KMA_TT_8-G8-P6' },
      { code: 'KMA_TT_8-G8-P6-2', name: '6.2 - Giang bai - Buoc giai', mychst: 'KMA_TT_8-G8-P6' },
      { code: 'KMA_TT_8-G8-P6-3', name: '6.3 - Goi HS - Buoc giai', mychst: 'KMA_TT_8-G8-P6' },
      { code: 'KMA_TT_8-G8-P6-4', name: '6.4 - Giang bai - Kien thuc', mychst: 'KMA_TT_8-G8-P6' },
      { code: 'KMA_TT_8-G8-P6-5', name: '6.5 - Goi ca lop - Viet', mychst: 'KMA_TT_8-G8-P6' },
      { code: 'KMA_TT_8-G8-P6-6', name: '6.6 - Goi HS - Phat bieu', mychst: 'KMA_TT_8-G8-P6' },
      { code: 'KMA_TT_8-G8-P6-7', name: '6.7 - Goi HS - But bang', mychst: 'KMA_TT_8-G8-P6' },
      { code: 'KMA_TT_8-G8-P7-1', name: '7.1 - Goi HS-Doc', mychst: 'KMA_TT_8-G8-P7' },
      { code: 'KMA_TT_8-G8-P7-2', name: '7.2 - Giang bai - Buoc giai', mychst: 'KMA_TT_8-G8-P7' },
      { code: 'KMA_TT_8-G8-P7-3', name: '7.3 - Goi HS - Buoc giai', mychst: 'KMA_TT_8-G8-P7' },
      { code: 'KMA_TT_8-G8-P7-4', name: '7.4 - Giang bai - Kien thuc', mychst: 'KMA_TT_8-G8-P7' },
      { code: 'KMA_TT_8-G8-P7-5', name: '7.5 - Goi ca lop - Viet', mychst: 'KMA_TT_8-G8-P7' },
      { code: 'KMA_TT_8-G8-P8-1', name: '8.1 - Goi HS-Doc', mychst: 'KMA_TT_8-G8-P8' },
      { code: 'KMA_TT_8-G8-P8-2', name: '8.2 - Giang bai - Buoc giai', mychst: 'KMA_TT_8-G8-P8' },
      { code: 'KMA_TT_8-G8-P8-3', name: '8.3 - Goi HS - But bang', mychst: 'KMA_TT_8-G8-P8' },
      { code: 'KMA_TT_8-G8-P9-1', name: '9.1 - Goi HS - Doc', mychst: 'KMA_TT_8-G8-P9' },
      { code: 'KMA_TT_8-G8-P9-2', name: '9.2 - Giang bai - But bang', mychst: 'KMA_TT_8-G8-P9' },
      { code: 'KMA_TT_8-G8-P9-3', name: '9.3 - Giao ca lop - Viet', mychst: 'KMA_TT_8-G8-P9' },
      { code: 'KMA_TT_8-G8-P10-1', name: '10.1 - Mo EDB', mychst: 'KMA_TT_8-G8-P10' },
      { code: 'KMA_TT_8-G8-P11-1', name: '11.1 - Goi HS-Doc', mychst: 'KMA_TT_8-G8-P11' },
      { code: 'KMA_TT_8-G8-P11-2', name: '11.2 - Bai giai - Buoc giai', mychst: 'KMA_TT_8-G8-P11' },
      { code: 'KMA_TT_8-G8-P11-3', name: '11.3 - Goi HS - Buoc giai', mychst: 'KMA_TT_8-G8-P11' },
      { code: 'KMA_TT_8-G8-P11-4', name: '11.4 - Giang bai - Kien thuc', mychst: 'KMA_TT_8-G8-P11' },
      { code: 'KMA_TT_8-G8-P11-5', name: '11.5 - Goi ca lop - Viet', mychst: 'KMA_TT_8-G8-P11' },
      { code: 'KMA_TT_8-G8-P12-1', name: '12.1 - Goi HS-Doc', mychst: 'KMA_TT_8-G8-P12' },
      { code: 'KMA_TT_8-G8-P12-2', name: '12.2 - Giao ca lop - Bang phu', mychst: 'KMA_TT_8-G8-P12' },
      { code: 'KMA_TT_8-G8-P12-3', name: '12.3 - Goi HS - Chua bang phu', mychst: 'KMA_TT_8-G8-P12' },
      { code: 'KMA_TT_8-G8-P13-1', name: '13.1 - Giang bai - But bang', mychst: 'KMA_TT_8-G8-P13' },
      { code: 'KMA_TT_8-G8-P13-2', name: '13.2 - Giao ca lop - Viet', mychst: 'KMA_TT_8-G8-P13' },
      { code: 'KMA_TT_8-G8-P14-1', name: '14.1 - Giang bai - Giang KT', mychst: 'KMA_TT_8-G8-P14' },
      { code: 'KMA_TT_8-G8-P15-1', name: '15.1 - Giang bai - Giang KT', mychst: 'KMA_TT_8-G8-P15' },
    ];

    // INSERT CHST
    console.log('=== Inserting 12 CHST for G8-GE ===');
    for (const row of chstData) {
      await conn.query(
        `INSERT INTO bp_chst_checksteptemp (code, name, mychpt, mychlt, checksample, mychrt, created_at, updated_at, published)
         VALUES (?, ?, ?, NULL, 1, NULL, NOW(), NULL, b'1')`,
        [row.code, row.name, MYCHPT]
      );
    }
    console.log(`Inserted ${chstData.length} CHST`);

    // INSERT CHLT
    console.log('=== Inserting 32 CHLT for G8-GE ===');
    for (const row of chltData) {
      await conn.query(
        `INSERT INTO bp_chlt_checklisttemp (code, name, mychst, myparentchlt, scoretype, score1, scoretype2, score2, \`do\`, donot, correctexample, incorrectexample, created_at, updated_at, published)
         VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NULL, b'1')`,
        [row.code, row.name, row.mychst]
      );
    }
    console.log(`Inserted ${chltData.length} CHLT`);

    // Note: CHPI, CHSI, CHLI instances were deleted.
    // They will be re-created when user clicks "Create Audit" again.
    // Also need to clean up audit_session_status for the deleted CHPI codes.

    // Verify
    console.log('\n=== VERIFICATION ===');
    const [chst] = await conn.query('SELECT code, name, mychpt FROM bp_chst_checksteptemp WHERE mychpt = ? ORDER BY code', [MYCHPT]);
    console.log(`CHST under ${MYCHPT}: ${chst.length}`);
    chst.forEach(r => console.log(`  ${r.code} -> ${r.name}`));

    const [chlt] = await conn.query(
      `SELECT chlt.code, chlt.name, chlt.mychst FROM bp_chlt_checklisttemp chlt
       WHERE chlt.mychst IN (SELECT code FROM bp_chst_checksteptemp WHERE mychpt = ?)
       ORDER BY chlt.mychst, chlt.code`, [MYCHPT]
    );
    console.log(`\nCHLT under ${MYCHPT}: ${chlt.length}`);
    chlt.forEach(r => console.log(`  ${r.code} -> ${r.name}`));

    console.log('\n--- DONE ---');
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
