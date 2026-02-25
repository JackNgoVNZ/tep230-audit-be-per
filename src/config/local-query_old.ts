import { LocalDataSource } from './local-database';

/**
 * Execute a raw SQL query against the local SQLite database.
 * Used for supplementary tables: audit_threshold_config, audit_session_status,
 * audit_feedback, audit_email_template.
 *
 * Note: SQLite dialect differences from MySQL:
 * - Use datetime('now') instead of NOW()
 * - No STDDEV() function
 * - Use ? for parameters (same as MySQL)
 */
export async function localQuery(sql: string, params?: any[]): Promise<any> {
  return LocalDataSource.query(sql, params);
}
