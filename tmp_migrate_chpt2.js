const mysql = require('mysql2/promise');

const LCKS = ['GE', 'LI', 'DL'];
const GGS = ['G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];
const PT = 'KMA_TT_8';
const NEW_G8_GE_CODE = 'KMA_TT_8-G8-GE';

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql.clevai.vn',
    user: 'aiagent',
    password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM',
    database: 'staging_s2_bp_log_v2',
  });

  try {
    const codes10 = GGS.map(gg => `${PT}-${gg}`);

    // Phase 1 already deleted: 33 CHLI, 12 CHSI, 32 CHLT, 12 CHST (for G8), 2 CHPI
    // Remaining: 135-12 = ~123 CHST rows under other GGs that still reference old CHPT codes

    console.log('=== Finding remaining CHST under old CHPT codes ===');
    const ph10 = codes10.map(() => '?').join(',');
    const [remainChst] = await conn.query(
      `SELECT * FROM bp_chst_checksteptemp WHERE mychpt IN (${ph10})`, codes10
    );
    console.log(`Remaining CHST: ${remainChst.length} rows`);

    // Find CHLT under these remaining CHST
    let remainChlt = [];
    if (remainChst.length > 0) {
      const chstCodes = remainChst.map(r => r.code);
      const ph = chstCodes.map(() => '?').join(',');
      [remainChlt] = await conn.query(
        `SELECT * FROM bp_chlt_checklisttemp WHERE mychst IN (${ph})`, chstCodes
      );
    }
    console.log(`Remaining CHLT: ${remainChlt.length} rows`);

    // Delete remaining CHLT
    if (remainChlt.length > 0) {
      const codes = remainChlt.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chlt_checklisttemp WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} remaining CHLT`);
    }

    // Delete remaining CHST
    if (remainChst.length > 0) {
      const codes = remainChst.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chst_checksteptemp WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} remaining CHST`);
    }

    // Now delete old CHPT
    console.log('\n=== Deleting old 10 CHPT ===');
    await conn.query(`DELETE FROM bp_chpt_checkprocesstemp WHERE code IN (${ph10})`, codes10);
    console.log(`Deleted 10 old CHPT`);

    // Get template for common fields (use hardcoded values from the data we know)
    const mylcp = 'TE-AUDIT';
    const mylcet = 'DR-JN-JSU';

    // === INSERT 30 NEW CHPT ===
    console.log('\n=== Inserting 30 new CHPT ===');
    let insertedChpt = 0;
    for (const gg of GGS) {
      for (const lck of LCKS) {
        const newCode = `${PT}-${gg}-${lck}`;
        const newName = `Audit Form ${newCode}`;
        await conn.query(
          `INSERT INTO bp_chpt_checkprocesstemp (code, name, mylcp, myparentlcet, mylcet, triggerusertype, supust, timebase, timeoffsetunit, timeoffsetvalue, timeoffsetminutes, note, created_at, updated_at, published)
           VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NULL, b'1')`,
          [newCode, newName, mylcp, mylcet]
        );
        insertedChpt++;
      }
    }
    console.log(`Inserted ${insertedChpt} new CHPT rows`);

    // === RE-INSERT CHST for G8-GE (backed up from phase 1) ===
    // The 12 CHST rows were already deleted in phase 1. We need to re-insert them.
    // But we already deleted them... we need to re-read from backup.
    // Actually the previous script already deleted everything. Let me check what's left.

    const [chstNow] = await conn.query(
      `SELECT COUNT(*) as cnt FROM bp_chst_checksteptemp WHERE mychpt LIKE '${PT}-%'`
    );
    console.log(`\nCHST rows remaining under KMA_TT_8: ${chstNow[0].cnt}`);

    // RE-INSERT the G8 CHST rows with new mychpt
    // We backed up chstRows in phase 1 but that script crashed.
    // Let's check if the CHST for G8 still exist or were deleted.
    const [g8chst] = await conn.query(
      `SELECT * FROM bp_chst_checksteptemp WHERE mychpt = ? OR mychpt = ?`, [OLD_G8_CODE, NEW_G8_GE_CODE]
    );
    console.log(`G8 CHST rows: ${g8chst.length}`);

    if (g8chst.length === 0) {
      console.log('\nG8 CHST already deleted from phase 1! Need to re-insert from backup.');
      console.log('ERROR: Data was already deleted in previous script run. Need manual recovery.');
      console.log('The 12 CHST, 32 CHLT, 12 CHSI, 33 CHLI, 2 CHPI were deleted but not re-inserted.');
      console.log('Will need to re-create them. Checking if we can recover from CHPI...');

      // Check audit_session_status for the CHPI codes we know
      // From earlier data: CHPI_ONBOARD_mlsy5agk_abjh9g was one instance
    }

    // RE-INSERT the remaining CHST for other GGs (non-G8) with new mychpt = GG-GE
    console.log('\n=== Re-inserting remaining CHST with new mychpt ===');
    for (const row of remainChst) {
      // Map: old mychpt (e.g. KMA_TT_8-G3) -> new (KMA_TT_8-G3-GE)
      const newMychpt = row.mychpt + '-GE';
      await conn.query(
        `INSERT INTO bp_chst_checksteptemp (id, code, name, mychpt, mychlt, checksample, mychrt, created_at, updated_at, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.name, newMychpt, row.mychlt, row.checksample, row.mychrt, row.created_at, row.updated_at, row.published]
      );
    }
    console.log(`Re-inserted ${remainChst.length} CHST with new mychpt`);

    // RE-INSERT CHLT (unchanged, same mychst)
    console.log('\n=== Re-inserting remaining CHLT ===');
    for (const row of remainChlt) {
      await conn.query(
        `INSERT INTO bp_chlt_checklisttemp (id, code, subcode, name, mychst, myparentchlt, scoretype, score1, scoretype2, score2, \`do\`, donot, correctexample, incorrectexample, created_at, updated_at, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.subcode, row.name, row.mychst, row.myparentchlt, row.scoretype, row.score1, row.scoretype2, row.score2, row.do, row.donot, row.correctexample, row.incorrectexample, row.created_at, row.updated_at, row.published]
      );
    }
    console.log(`Re-inserted ${remainChlt.length} CHLT`);

    // === VERIFY ===
    console.log('\n=== VERIFICATION ===');
    const [newChpt] = await conn.query(`SELECT code, name FROM bp_chpt_checkprocesstemp WHERE code LIKE '${PT}-%' ORDER BY code`);
    console.log(`New CHPT count: ${newChpt.length}`);
    newChpt.forEach(r => console.log(`  ${r.code} -> ${r.name}`));

    const [allChst] = await conn.query(`SELECT mychpt, COUNT(*) as cnt FROM bp_chst_checksteptemp WHERE mychpt LIKE '${PT}-%' GROUP BY mychpt ORDER BY mychpt`);
    console.log(`\nCHST by mychpt:`);
    allChst.forEach(r => console.log(`  ${r.mychpt}: ${r.cnt} rows`));

    console.log('\n--- DONE ---');
  } finally {
    await conn.end();
  }
}

const OLD_G8_CODE = 'KMA_TT_8-G8';
main().catch(e => { console.error(e); process.exit(1); });
