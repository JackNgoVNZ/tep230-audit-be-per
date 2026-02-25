const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql.clevai.vn',
    user: 'aiagent',
    password: 'qduVCAyNBneBWxpQMcKsbGjfixyTZbIOpTpWrDAJ6BofHQYYgsPLaj3y07bLZClM',
    database: 'staging_s2_bp_log_v2',
  });

  try {
    // 1. Get all audit_session_status rows
    const [sessions] = await conn.query('SELECT id, chpi_code, audit_type, status, total_score, created_at FROM audit_session_status');
    console.log(`Total audit_session_status rows: ${sessions.length}`);

    if (sessions.length === 0) {
      console.log('No audit sessions found. Nothing to clean up.');
      return;
    }

    // 2. Check which chpi_codes still exist in bp_chpi_checkprocessitem
    const chpiCodes = sessions.map(s => s.chpi_code);
    const ph = chpiCodes.map(() => '?').join(',');
    const [existingChpi] = await conn.query(
      `SELECT code FROM bp_chpi_checkprocessitem WHERE code IN (${ph})`,
      chpiCodes
    );
    const existingSet = new Set(existingChpi.map(r => r.code));
    console.log(`Existing CHPI in DB: ${existingSet.size}`);

    // 3. Identify orphaned sessions
    const orphaned = sessions.filter(s => !existingSet.has(s.chpi_code));
    const valid = sessions.filter(s => existingSet.has(s.chpi_code));

    console.log(`\n=== ORPHANED audit_session_status (CHPI deleted) ===`);
    console.log(`Count: ${orphaned.length}`);
    orphaned.forEach(s => {
      console.log(`  id=${s.id} chpi_code=${s.chpi_code} type=${s.audit_type} status=${s.status} score=${s.total_score} created=${s.created_at}`);
    });

    console.log(`\n=== VALID audit_session_status (CHPI exists) ===`);
    console.log(`Count: ${valid.length}`);
    valid.forEach(s => {
      console.log(`  id=${s.id} chpi_code=${s.chpi_code} type=${s.audit_type} status=${s.status}`);
    });

    // 4. Delete orphaned rows
    if (orphaned.length > 0) {
      const orphanIds = orphaned.map(s => s.id);
      const phIds = orphanIds.map(() => '?').join(',');
      await conn.query(`DELETE FROM audit_session_status WHERE id IN (${phIds})`, orphanIds);
      console.log(`\nDeleted ${orphaned.length} orphaned audit_session_status rows.`);
    } else {
      console.log('\nNo orphaned rows to delete.');
    }

    // 5. Verify
    const [remaining] = await conn.query('SELECT COUNT(*) as cnt FROM audit_session_status');
    console.log(`\nRemaining audit_session_status rows: ${remaining[0].cnt}`);

    console.log('\n--- DONE ---');
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
