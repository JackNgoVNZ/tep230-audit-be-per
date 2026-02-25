import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditThresholdConfig1700000001 implements MigrationInterface {
  name = 'CreateAuditThresholdConfig1700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_threshold_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(128) NOT NULL UNIQUE,
        audit_type VARCHAR(32) NOT NULL,
        threshold_type VARCHAR(32) NOT NULL,
        min_score DECIMAL(4,2) DEFAULT NULL,
        max_score DECIMAL(4,2) DEFAULT NULL,
        has_second_audit TINYINT(1) DEFAULT 0,
        has_unreg4 TINYINT(1) DEFAULT 0,
        published TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_audit_type (audit_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_threshold_config`);
  }
}
