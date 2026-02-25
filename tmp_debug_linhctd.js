require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // 1. Find ALL CHPI records for linhctd (force re-backfill with SSTE slide + VCR video)
  const [chpiRows] = await conn.execute(
    "SELECT code, mytrigger, myulc, myclag, mycti1, mycti2, description FROM bp_chpi_checkprocessitem WHERE mytrigger = ?",
    ['linhctd']
  );
  console.log('CHPI records to backfill:', chpiRows.length);

  for (const chpi of chpiRows) {
    console.log('\n--- Processing CHPI:', chpi.code, '---');
    const myulc = chpi.myulc;
    let resolvedClag = chpi.myclag;

    // Step 1: Try bp_cuie_details.myclag
    if (!resolvedClag && chpi.description) {
      const [cuieRows] = await conn.execute(
        'SELECT myclag FROM staging_s2_parent_report_db.bp_cuie_details WHERE mycuie = ? LIMIT 1',
        [chpi.description]
      );
      if (cuieRows.length > 0 && cuieRows[0].myclag) {
        resolvedClag = cuieRows[0].myclag;
        console.log('  CLAG from bp_cuie_details:', resolvedClag);
      }
    }

    // Step 2: Fallback bp_cuie_details_usi (teacher + mypt + mygg, no date)
    if (!resolvedClag) {
      const [ptRows] = await conn.execute(
        'SELECT mypt, mygg FROM staging_s2_parent_report_db.bp_cuie_details WHERE mycuie = ? LIMIT 1',
        [chpi.description]
      );
      if (ptRows.length > 0) {
        const [clagRows] = await conn.execute(
          'SELECT DISTINCT myclag FROM staging_s2_parent_report_db.bp_cuie_details_usi WHERE mygte = ? AND mypt = ? AND mygg = ? AND myclag IS NOT NULL LIMIT 1',
          [chpi.mytrigger, ptRows[0].mypt, ptRows[0].mygg]
        );
        if (clagRows.length > 0) {
          resolvedClag = clagRows[0].myclag;
          console.log('  CLAG from bp_cuie_details_usi:', resolvedClag);
        }
      }
    }

    // Step 3: mycti1 — Slide Teacher (SSTE) via bp_cui_content_user_ulc_instance → bp_cti_contentitem
    let mycti1 = null;
    if (myulc && chpi.mytrigger) {
      const [ssteRows] = await conn.execute(
        `SELECT cti.myvalueset
         FROM bp_cui_content_user_ulc_instance cui
         JOIN bp_cti_contentitem cti ON cui.mycti = cti.myparentcti
         WHERE cui.myusi = ? AND cui.myulc = ? AND cti.myctt = 'CTI_SSTE'
         LIMIT 1`,
        [chpi.mytrigger, myulc]
      );
      if (ssteRows.length > 0 && ssteRows[0].myvalueset) {
        mycti1 = ssteRows[0].myvalueset;
      }
      console.log('  mycti1 (slide):', mycti1 ? mycti1.substring(0, 80) + '...' : null);
    }

    // Step 4: mycti2 — All video links from VCR
    let mycti2 = null;
    if (myulc && chpi.mytrigger) {
      const [vcrRows] = await conn.execute(
        `SELECT COALESCE(
            IF(vcr.code LIKE '%-%', vcr.view_url, cti.starturl),
            vcr.view_url
         ) AS view_url
         FROM bp_usi_vcr_meeting uvm
         JOIN bp_ulc_uniquelearningcomponent ulc ON uvm.myulc = ulc.code
         JOIN bp_cap_calendarperiod cap ON ulc.mycap = cap.code
         JOIN bp_vcr_meeting vcr ON vcr.code = uvm.myvcr
         LEFT JOIN bp_cti_contentitem cti
             ON vcr.code NOT LIKE '%-%'
            AND DATE(vcr.start_time) = DATE(cti.created_at)
            AND vcr.clag_code = cti.secretkey
         WHERE uvm.myusi = ? AND uvm.myulc = ?
         ORDER BY DATE(cap.startperiod) DESC`,
        [chpi.mytrigger, myulc]
      );
      const urls = vcrRows
        .map(r => r.view_url)
        .filter(u => u != null && u !== '');
      if (urls.length > 0) {
        mycti2 = JSON.stringify(urls);
      }
      console.log('  mycti2 (videos):', urls.length, 'URLs found');
    }

    // Step 5: Update CHPI
    await conn.execute(
      'UPDATE bp_chpi_checkprocessitem SET mycti1 = ?, mycti2 = ?, myclag = ? WHERE code = ?',
      [mycti1, mycti2, resolvedClag, chpi.code]
    );
    console.log('  UPDATED:', chpi.code);
  }

  // Verify
  console.log('\n=== VERIFICATION ===');
  const [verify] = await conn.execute(
    'SELECT code, mycti1, mycti2, myclag FROM bp_chpi_checkprocessitem WHERE mytrigger = ?',
    ['linhctd']
  );
  for (const r of verify) {
    console.log(r.code);
    console.log('  mycti1 (slide):', r.mycti1 ? r.mycti1.substring(0, 80) + '...' : null);
    let videoCount = null;
    if (r.mycti2) { try { videoCount = JSON.parse(r.mycti2).length + ' URLs'; } catch { videoCount = 'NOT JSON: ' + r.mycti2.substring(0, 50); } }
    console.log('  mycti2 (videos):', videoCount);
    console.log('  myclag:', r.myclag);
  }

  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
