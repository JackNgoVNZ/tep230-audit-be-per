import { AppDataSource } from '../src/config/database';

async function main() {
  await AppDataSource.initialize();
  console.log('DB connected');

  const chpiCode = 'CHPI_Onboard Audit_mlxycptp_veft11';

  // 1. Get CHPI
  const chpi = await AppDataSource.query(
    'SELECT code, mytrigger, mycuievent, description, myulc, myclag FROM bp_chpi_checkprocessitem WHERE code = ?',
    [chpiCode]
  );
  console.log('=== CHPI ===');
  console.log(JSON.stringify(chpi, null, 2));

  if (!chpi.length) {
    console.log('CHPI not found!');
    await AppDataSource.destroy();
    return;
  }

  const desc = chpi[0].description;
  const trigger = chpi[0].mytrigger;

  // 2. Find CUIE - try by description (cuie_code stored there), then by trigger
  let cuieRow: any = null;

  if (desc) {
    const cuie1 = await AppDataSource.query(
      'SELECT mycuie, myulc, myclag FROM staging_s2_parent_report_db.bp_cuie_details WHERE mycuie = ? LIMIT 1',
      [desc]
    );
    console.log('=== CUIE by desc ===', JSON.stringify(cuie1));
    if (cuie1.length) cuieRow = cuie1[0];
  }

  if (!cuieRow && trigger) {
    const cuie2 = await AppDataSource.query(
      "SELECT mycuie, myulc, myclag FROM staging_s2_parent_report_db.bp_cuie_details WHERE myusi = ? AND mylcet_lceventtype = 'DR-JN-JSU' LIMIT 1",
      [trigger]
    );
    console.log('=== CUIE by trigger ===', JSON.stringify(cuie2));
    if (cuie2.length) cuieRow = cuie2[0];
  }

  if (!cuieRow) {
    console.log('No CUIE found for this CHPI!');
    await AppDataSource.destroy();
    return;
  }

  console.log('=== Found CUIE ===', JSON.stringify(cuieRow));

  // 3. Update CHPI with myulc/myclag
  await AppDataSource.query(
    'UPDATE bp_chpi_checkprocessitem SET myulc = ?, myclag = ? WHERE code = ?',
    [cuieRow.myulc, cuieRow.myclag, chpiCode]
  );
  console.log(`Updated CHPI ${chpiCode}: myulc=${cuieRow.myulc}, myclag=${cuieRow.myclag}`);

  // 4. Verify
  const verify = await AppDataSource.query(
    'SELECT code, myulc, myclag FROM bp_chpi_checkprocessitem WHERE code = ?',
    [chpiCode]
  );
  console.log('=== Verify ===', JSON.stringify(verify));

  await AppDataSource.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
