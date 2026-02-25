import 'dotenv/config';
import { AppDataSource } from './src/config/database';

const SRC_CHPT = 'GES4-75MI-FD1-GE4-75MI-AF-FN-AVI-KEN_TT_8-G3';
const DST_CHPT = 'GES4-75MI-FD1-GE4-75MI-AF-FN-AVI-KEN_TT_8-G6';

async function main() {
  await AppDataSource.initialize();

  // 1. Get CHST from G3
  const srcChsts = await AppDataSource.query(
    `SELECT code, name, checksample FROM bp_chst_checksteptemp
     WHERE mychpt = ? AND published + 0 = 1 ORDER BY code`,
    [SRC_CHPT]
  );
  console.log(`Source CHST (G3): ${srcChsts.length}`);

  // 2. Check if G6 already has CHST
  const existChst = await AppDataSource.query(
    `SELECT COUNT(*) AS cnt FROM bp_chst_checksteptemp WHERE mychpt = ?`, [DST_CHPT]
  );
  console.log(`Existing CHST in G6: ${existChst[0].cnt}`);

  let totalChst = 0, totalChlt = 0;

  for (const chst of srcChsts) {
    const newChstCode = chst.code.replace('-G3-', '-G6-');

    // Check duplicate
    const dup = await AppDataSource.query(
      'SELECT code FROM bp_chst_checksteptemp WHERE code = ?', [newChstCode]
    );
    if (dup.length > 0) {
      console.log(`  SKIP CHST ${newChstCode} (exists)`);
      continue;
    }

    await AppDataSource.query(
      `INSERT INTO bp_chst_checksteptemp (code, name, checksample, mychpt, created_at, published)
       VALUES (?, ?, ?, ?, NOW(), 1)`,
      [newChstCode, chst.name, chst.checksample, DST_CHPT]
    );
    totalChst++;
    console.log(`  ✅ CHST ${newChstCode}`);

    // 3. Clone CHLT
    const srcChlts = await AppDataSource.query(
      `SELECT code, subcode, name, myparentchlt, scoretype, score1, scoretype2, score2,
              \`do\`, donot, correctexample, incorrectexample
       FROM bp_chlt_checklisttemp WHERE mychst = ? AND published + 0 = 1 ORDER BY code`,
      [chst.code]
    );

    for (const chlt of srcChlts) {
      const newChltCode = chlt.code.replace('-G3-', '-G6-');
      const newParent = chlt.myparentchlt ? chlt.myparentchlt.replace('-G3-', '-G6-') : null;

      await AppDataSource.query(
        `INSERT INTO bp_chlt_checklisttemp
           (code, subcode, name, mychst, myparentchlt, scoretype, score1, scoretype2, score2,
            \`do\`, donot, correctexample, incorrectexample, created_at, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)`,
        [newChltCode, chlt.subcode, chlt.name, newChstCode, newParent,
         chlt.scoretype, chlt.score1, chlt.scoretype2, chlt.score2,
         chlt.do, chlt.donot, chlt.correctexample, chlt.incorrectexample]
      );
      totalChlt++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`CHST created: ${totalChst}`);
  console.log(`CHLT created: ${totalChlt}`);

  // Verify
  const vChst = await AppDataSource.query(
    'SELECT COUNT(*) AS cnt FROM bp_chst_checksteptemp WHERE mychpt = ? AND published + 0 = 1', [DST_CHPT]
  );
  const vChlt = await AppDataSource.query(
    `SELECT COUNT(*) AS cnt FROM bp_chlt_checklisttemp chlt
     INNER JOIN bp_chst_checksteptemp chst ON chst.code = chlt.mychst
     WHERE chst.mychpt = ? AND chlt.published + 0 = 1`, [DST_CHPT]
  );
  console.log(`\nKEN_TT_8-G6: ${vChst[0].cnt} steps, ${vChlt[0].cnt} checklist items`);

  await AppDataSource.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
