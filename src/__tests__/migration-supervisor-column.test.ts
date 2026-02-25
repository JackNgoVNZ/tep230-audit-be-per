import * as fs from 'fs';
import * as path from 'path';

describe('Migration 008 — supervisor_code column (legacy SQLite)', () => {
  it('migration SQL contains ALTER TABLE audit_session_status ADD COLUMN supervisor_code', () => {
    const migrationPath = path.join(__dirname, '../migrations/008-add-supervisor-column.ts');
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('ALTER TABLE audit_session_status');
    expect(content).toContain('ADD COLUMN supervisor_code');
    expect(content).toContain('VARCHAR(128)');
  });

  it('entity has supervisor_code field', () => {
    const entityPath = path.join(__dirname, '../entities/audit-session-status.local-entity.ts');
    const content = fs.readFileSync(entityPath, 'utf-8');

    expect(content).toContain('supervisor_code');
  });
});

describe('Supervisor assignment — MySQL CHPI description tag', () => {
  it('supervisor-assignment service uses [SUP:code] tag in CHPI description', () => {
    const servicePath = path.join(__dirname, '../modules/supervisor-assignment/supervisor-assignment.service.ts');
    const content = fs.readFileSync(servicePath, 'utf-8');

    // Verify service uses CONCAT with [SUP: tag on CHPI description (not SQLite)
    expect(content).toContain('[SUP:');
    expect(content).toContain('UPDATE bp_chpi_checkprocessitem');
    // Verify no localQuery import
    expect(content).not.toContain('localQuery');
  });
});
