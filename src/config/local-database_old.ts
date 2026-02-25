import { DataSource } from 'typeorm';
import path from 'path';
import { AuditThresholdConfig } from '../entities/audit-threshold-config.local-entity';
import { AuditSessionStatus } from '../entities/audit-session-status.local-entity';
import { AuditFeedback } from '../entities/audit-feedback.local-entity';
import { AuditEmailTemplate } from '../entities/audit-email-template.local-entity';

const dbPath = path.join(__dirname, '..', '..', 'data', 'audit-local.sqlite');

export const LocalDataSource = new DataSource({
  type: 'better-sqlite3',
  database: dbPath,
  entities: [AuditThresholdConfig, AuditSessionStatus, AuditFeedback, AuditEmailTemplate],
  synchronize: true,
  logging: false,
});
