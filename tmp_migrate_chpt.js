const mysql = require('mysql2/promise');

const LCKS = ['GE', 'LI', 'DL'];
const GGS = ['G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];
const PT = 'KMA_TT_8';
const OLD_G8_CODE = 'KMA_TT_8-G8';
const NEW_G8_GE_CODE = 'KMA_TT_8-G8-GE';

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql.clevai.vn',
    user: 'aiagent',
    password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM',
    database: 'staging_s2_bp_log_v2',
  });

  try {
    // === PHASE 1: READ ALL DATA ===
    console.log('=== PHASE 1: Reading data ===');

    // Read 10 old CHPT rows
    const [oldChpt] = await conn.query(
      `SELECT * FROM bp_chpt_checkprocesstemp WHERE code LIKE '${PT}-%' AND code NOT LIKE '${PT}-%-%-%--%' ORDER BY code`
    );
    console.log(`Old CHPT: ${oldChpt.length} rows`);
    // Filter only 2-part codes (PT-GG, not PT-GG-LCK)
    const old10 = oldChpt.filter(r => {
      const parts = r.code.replace(`${PT}-`, '').split('-');
      return parts.length === 1; // Only GG part after PT
    });
    console.log(`Filtered old CHPT (PT-GG only): ${old10.length} rows`);
    old10.forEach(r => console.log(`  ${r.code}`));

    // Read CHST under KMA_TT_8-G8
    const [chstRows] = await conn.query(
      `SELECT * FROM bp_chst_checksteptemp WHERE mychpt = ?`, [OLD_G8_CODE]
    );
    console.log(`CHST under ${OLD_G8_CODE}: ${chstRows.length} rows`);

    // Read CHLT under those CHST
    let chltRows = [];
    if (chstRows.length > 0) {
      const chstCodes = chstRows.map(r => r.code);
      const ph = chstCodes.map(() => '?').join(',');
      [chltRows] = await conn.query(
        `SELECT * FROM bp_chlt_checklisttemp WHERE mychst IN (${ph})`, chstCodes
      );
    }
    console.log(`CHLT: ${chltRows.length} rows`);

    // Read CHPI under any of the 10 old CHPT codes
    const oldCodes = old10.map(r => r.code);
    const oldPh = oldCodes.map(() => '?').join(',');
    const [chpiRows] = await conn.query(
      `SELECT * FROM bp_chpi_checkprocessitem WHERE mychpt IN (${oldPh})`, oldCodes
    );
    console.log(`CHPI referencing old CHPT: ${chpiRows.length} rows`);

    // Read CHSI under those CHPI
    let chsiRows = [];
    if (chpiRows.length > 0) {
      const chpiCodes = chpiRows.map(r => r.code);
      const ph2 = chpiCodes.map(() => '?').join(',');
      [chsiRows] = await conn.query(
        `SELECT * FROM bp_chsi_checkstepitem WHERE mychpi IN (${ph2})`, chpiCodes
      );
    }
    console.log(`CHSI: ${chsiRows.length} rows`);

    // Read CHLI under those CHSI
    let chliRows = [];
    if (chsiRows.length > 0) {
      const chsiCodes = chsiRows.map(r => r.code);
      const ph3 = chsiCodes.map(() => '?').join(',');
      [chliRows] = await conn.query(
        `SELECT * FROM bp_chli_checklistitem WHERE mychsi IN (${ph3})`, chsiCodes
      );
    }
    console.log(`CHLI: ${chliRows.length} rows`);

    // === PHASE 2: DELETE BOTTOM-UP ===
    console.log('\n=== PHASE 2: Deleting bottom-up ===');

    // Delete CHLI
    if (chliRows.length > 0) {
      const codes = chliRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chli_checklistitem WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHLI`);
    }

    // Delete CHSI
    if (chsiRows.length > 0) {
      const codes = chsiRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chsi_checkstepitem WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHSI`);
    }

    // Delete CHLT
    if (chltRows.length > 0) {
      const codes = chltRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chlt_checklisttemp WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHLT`);
    }

    // Delete CHST
    if (chstRows.length > 0) {
      const codes = chstRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chst_checksteptemp WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHST`);
    }

    // Delete CHPI
    if (chpiRows.length > 0) {
      const codes = chpiRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chpi_checkprocessitem WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHPI`);
    }

    // Delete old CHPT
    if (old10.length > 0) {
      const ph = old10.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chpt_checkprocesstemp WHERE code IN (${ph})`, oldCodes);
      console.log(`Deleted ${old10.length} old CHPT`);
    }

    // === PHASE 3: INSERT NEW CHPT (30 rows) ===
    console.log('\n=== PHASE 3: Inserting 30 new CHPT ===');

    // Use first old row as template for common fields
    const template = old10[0];
    let insertedChpt = 0;
    for (const gg of GGS) {
      for (const lck of LCKS) {
        const newCode = `${PT}-${gg}-${lck}`;
        const newName = `Audit Form ${newCode}`;
        await conn.query(
          `INSERT INTO bp_chpt_checkprocesstemp (code, name, mylcp, myparentlcet, mylcet, triggerusertype, supust, timebase, timeoffsetunit, timeoffsetvalue, timeoffsetminutes, note, created_at, updated_at, published)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, b'1')`,
          [newCode, newName, template.mylcp, template.myparentlcet, template.mylcet, template.triggerusertype, template.supust, template.timebase, template.timeoffsetunit, template.timeoffsetvalue, template.timeoffsetminutes, template.note]
        );
        insertedChpt++;
      }
    }
    console.log(`Inserted ${insertedChpt} new CHPT rows`);

    // === PHASE 4: RE-INSERT CHST with new mychpt ===
    console.log('\n=== PHASE 4: Re-inserting CHST (mychpt -> KMA_TT_8-G8-GE) ===');

    for (const row of chstRows) {
      await conn.query(
        `INSERT INTO bp_chst_checksteptemp (id, code, name, mychpt, mychlt, checksample, mychrt, created_at, updated_at, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.name, NEW_G8_GE_CODE, row.mychlt, row.checksample, row.mychrt, row.created_at, row.updated_at, row.published]
      );
    }
    console.log(`Re-inserted ${chstRows.length} CHST (mychpt = ${NEW_G8_GE_CODE})`);

    // === PHASE 5: RE-INSERT CHLT (unchanged) ===
    console.log('\n=== PHASE 5: Re-inserting CHLT ===');
    for (const row of chltRows) {
      await conn.query(
        `INSERT INTO bp_chlt_checklisttemp (id, code, subcode, name, mychst, myparentchlt, scoretype, score1, scoretype2, score2, \`do\`, donot, correctexample, incorrectexample, created_at, updated_at, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.subcode, row.name, row.mychst, row.myparentchlt, row.scoretype, row.score1, row.scoretype2, row.score2, row.do, row.donot, row.correctexample, row.incorrectexample, row.created_at, row.updated_at, row.published]
      );
    }
    console.log(`Re-inserted ${chltRows.length} CHLT`);

    // === PHASE 6: RE-INSERT CHPI with new mychpt ===
    console.log('\n=== PHASE 6: Re-inserting CHPI (mychpt -> KMA_TT_8-G8-GE) ===');
    for (const row of chpiRows) {
      // Map old mychpt to new: KMA_TT_8-G8 -> KMA_TT_8-G8-GE (default to GE for existing data)
      const newMychpt = row.mychpt + '-GE';
      await conn.query(
        `INSERT INTO bp_chpi_checkprocessitem (id, code, name, description, mychpt, mychpttype, mylcet, mycuievent, mytrigger, mychecker, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.name, row.description, newMychpt, row.mychpttype, row.mylcet, row.mycuievent, row.mytrigger, row.mychecker, row.created_at, row.updated_at]
      );
    }
    console.log(`Re-inserted ${chpiRows.length} CHPI`);

    // === PHASE 7: RE-INSERT CHSI (unchanged) ===
    console.log('\n=== PHASE 7: Re-inserting CHSI ===');
    for (const row of chsiRows) {
      await conn.query(
        `INSERT INTO bp_chsi_checkstepitem (id, code, name, checksample, mychpi, mychst, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.name, row.checksample, row.mychpi, row.mychst, row.description, row.created_at, row.updated_at]
      );
    }
    console.log(`Re-inserted ${chsiRows.length} CHSI`);

    // === PHASE 8: RE-INSERT CHLI (unchanged) ===
    console.log('\n=== PHASE 8: Re-inserting CHLI ===');
    for (const row of chliRows) {
      await conn.query(
        `INSERT INTO bp_chli_checklistitem (id, code, subcode, name, mychsi, myparentchlt, mysubchlt, description, \`do\`, donot, correctexample, incorrectexample, scoretype1, score1, scoretype2, score2, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.subcode, row.name, row.mychsi, row.myparentchlt, row.mysubchlt, row.description, row.do, row.donot, row.correctexample, row.incorrectexample, row.scoretype1, row.score1, row.scoretype2, row.score2, row.created_at, row.updated_at]
      );
    }
    console.log(`Re-inserted ${chliRows.length} CHLI`);

    // === VERIFY ===
    console.log('\n=== VERIFICATION ===');
    const [newChpt] = await conn.query(`SELECT code, name FROM bp_chpt_checkprocesstemp WHERE code LIKE '${PT}-%' ORDER BY code`);
    console.log(`New CHPT count: ${newChpt.length}`);
    newChpt.forEach(r => console.log(`  ${r.code} -> ${r.name}`));

    const [chstCheck] = await conn.query(`SELECT code, mychpt FROM bp_chst_checksteptemp WHERE mychpt = ?`, [NEW_G8_GE_CODE]);
    console.log(`\nCHST under ${NEW_G8_GE_CODE}: ${chstCheck.length} rows`);

    const [chpiCheck] = await conn.query(`SELECT code, mychpt FROM bp_chpi_checkprocessitem WHERE mychpt LIKE '${PT}-%'`);
    console.log(`CHPI with new mychpt: ${chpiCheck.length} rows`);
    chpiCheck.forEach(r => console.log(`  ${r.code} -> mychpt=${r.mychpt}`));

    console.log('\n--- DONE ---');
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
