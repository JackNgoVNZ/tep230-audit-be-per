const mysql = require('mysql2/promise');

// Mapping: CHST code suffix (P number) → page number to use in name
// Extract from code: KMA_TT_8-G8-P{N} → N
function extractPageNum(code) {
  const m = code.match(/-P(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

// For CHLT/CHLI: find the mychst page number, then build new prefix
// Current prefix mapping (what was wrongly set):
// P1→1, P4→2, P6→3, P7→4, P8→5, P9→6, P10→7, P11→8, P12→9, P13→10, P14→11, P15→12
// We need to reverse: replace the current prefix with the page number from the CHST code

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql.clevai.vn',
    user: 'aiagent',
    password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM',
    database: 'staging_s2_bp_log_v2',
  });

  try {
    // 1. Read all current data
    const [chstRows] = await conn.query(
      "SELECT * FROM bp_chst_checksteptemp WHERE mychpt = 'KMA_TT_8-G8' ORDER BY code"
    );
    console.log(`CHST: ${chstRows.length} rows`);

    const [chltRows] = await conn.query(
      "SELECT * FROM bp_chlt_checklisttemp WHERE mychst LIKE 'KMA_TT_8-G8%' ORDER BY mychst, code"
    );
    console.log(`CHLT: ${chltRows.length} rows`);

    const [chsiRows] = await conn.query(
      "SELECT * FROM bp_chsi_checkstepitem WHERE mychpi IN (SELECT code FROM bp_chpi_checkprocessitem WHERE mychpt = 'KMA_TT_8-G8') ORDER BY code"
    );
    console.log(`CHSI: ${chsiRows.length} rows`);

    const [chliRows] = await conn.query(
      "SELECT * FROM bp_chli_checklistitem WHERE mychsi IN (SELECT code FROM bp_chsi_checkstepitem WHERE mychpi IN (SELECT code FROM bp_chpi_checkprocessitem WHERE mychpt = 'KMA_TT_8-G8')) ORDER BY mychsi, code"
    );
    console.log(`CHLI: ${chliRows.length} rows`);

    // 2. Build CHST code → page number mapping
    const chstPageMap = {};  // chst_code → page_number
    for (const row of chstRows) {
      const pNum = extractPageNum(row.code);
      chstPageMap[row.code] = pNum;
    }
    console.log('\nCHST page map:', chstPageMap);

    // 3. Build current name prefix → target prefix for CHLT/CHLI
    // We need to know what the CURRENT prefix is for items under each CHST
    // Current: items under P4 have prefix "2.", under P6 have "3.", etc.
    // Target: items under P4 should have "4.", under P6 should have "6.", etc.

    // 4. Prepare new names for CHST
    const newChst = chstRows.map(row => {
      const pNum = extractPageNum(row.code);
      const newName = `Page ${pNum}`;
      console.log(`CHST: ${row.code}: "${row.name}" → "${newName}"`);
      return { ...row, name: newName };
    });

    // 5. Prepare new names for CHSI (same logic, extract page num from mychst)
    const newChsi = chsiRows.map(row => {
      const pNum = chstPageMap[row.mychst];
      const newName = `Page ${pNum}`;
      console.log(`CHSI: ${row.code}: "${row.name}" → "${newName}"`);
      return { ...row, name: newName };
    });

    // 6. Prepare new names for CHLT
    // Each CHLT has mychst → we know the target page number
    // Replace the leading number prefix: "2.1 - Bao cao" → "4.1 - Bao cao"
    const newChlt = chltRows.map(row => {
      const targetPageNum = chstPageMap[row.mychst];
      const newName = row.name.replace(/^\d+\./, `${targetPageNum}.`);
      if (newName !== row.name) {
        console.log(`CHLT: ${row.code}: "${row.name}" → "${newName}"`);
      }
      return { ...row, name: newName };
    });

    // 7. Prepare new names for CHLI
    // Each CHLI has mychsi → find which CHST it belongs to via CHSI
    const chsiToChst = {};
    for (const row of chsiRows) {
      chsiToChst[row.code] = row.mychst;
    }
    const newChli = chliRows.map(row => {
      const chstCode = chsiToChst[row.mychsi];
      const targetPageNum = chstPageMap[chstCode];
      const newName = row.name.replace(/^\d+\./, `${targetPageNum}.`);
      if (newName !== row.name) {
        console.log(`CHLI: ${row.code}: "${row.name}" → "${newName}"`);
      }
      return { ...row, name: newName };
    });

    // 8. Execute: DELETE bottom-up, INSERT top-down
    console.log('\n--- Executing DELETE + INSERT ---');

    // DELETE CHLI
    if (chliRows.length > 0) {
      const codes = chliRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chli_checklistitem WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHLI rows`);
    }

    // DELETE CHSI
    if (chsiRows.length > 0) {
      const codes = chsiRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chsi_checkstepitem WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHSI rows`);
    }

    // DELETE CHLT
    if (chltRows.length > 0) {
      const codes = chltRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chlt_checklisttemp WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHLT rows`);
    }

    // DELETE CHST
    if (chstRows.length > 0) {
      const codes = chstRows.map(r => r.code);
      const ph = codes.map(() => '?').join(',');
      await conn.query(`DELETE FROM bp_chst_checksteptemp WHERE code IN (${ph})`, codes);
      console.log(`Deleted ${codes.length} CHST rows`);
    }

    // INSERT CHST
    for (const row of newChst) {
      await conn.query(
        `INSERT INTO bp_chst_checksteptemp (id, code, name, mychpt, mychlt, checksample, mychrt, created_at, updated_at, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.name, row.mychpt, row.mychlt, row.checksample, row.mychrt, row.created_at, row.updated_at, row.published]
      );
    }
    console.log(`Inserted ${newChst.length} CHST rows`);

    // INSERT CHLT
    for (const row of newChlt) {
      await conn.query(
        `INSERT INTO bp_chlt_checklisttemp (id, code, subcode, name, mychst, myparentchlt, scoretype, score1, scoretype2, score2, \`do\`, donot, correctexample, incorrectexample, created_at, updated_at, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.subcode, row.name, row.mychst, row.myparentchlt, row.scoretype, row.score1, row.scoretype2, row.score2, row.do, row.donot, row.correctexample, row.incorrectexample, row.created_at, row.updated_at, row.published]
      );
    }
    console.log(`Inserted ${newChlt.length} CHLT rows`);

    // INSERT CHSI
    for (const row of newChsi) {
      await conn.query(
        `INSERT INTO bp_chsi_checkstepitem (id, code, name, checksample, mychpi, mychst, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.name, row.checksample, row.mychpi, row.mychst, row.description, row.created_at, row.updated_at]
      );
    }
    console.log(`Inserted ${newChsi.length} CHSI rows`);

    // INSERT CHLI
    for (const row of newChli) {
      await conn.query(
        `INSERT INTO bp_chli_checklistitem (id, code, subcode, name, mychsi, myparentchlt, mysubchlt, description, \`do\`, donot, correctexample, incorrectexample, scoretype1, score1, scoretype2, score2, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.code, row.subcode, row.name, row.mychsi, row.myparentchlt, row.mysubchlt, row.description, row.do, row.donot, row.correctexample, row.incorrectexample, row.scoretype1, row.score1, row.scoretype2, row.score2, row.created_at, row.updated_at]
      );
    }
    console.log(`Inserted ${newChli.length} CHLI rows`);

    console.log('\n--- DONE ---');

  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
