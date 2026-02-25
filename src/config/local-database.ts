import { AppDataSource } from './database';

// Re-export AppDataSource as LocalDataSource for backward compatibility.
// All 4 audit tables (audit_session_status, audit_threshold_config,
// audit_feedback, audit_email_template) now live on MySQL staging.
export const LocalDataSource = AppDataSource;
