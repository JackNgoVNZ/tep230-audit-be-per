import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditSessionStatus1700000002 implements MigrationInterface {
  name = 'CreateAuditSessionStatus1700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_session_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chpi_code VARCHAR(512) NOT NULL UNIQUE,
        audit_type VARCHAR(32) NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING',
        total_score DECIMAL(4,2) DEFAULT NULL,
        max_score DECIMAL(4,2) DEFAULT 5.00,
        threshold_result VARCHAR(32) DEFAULT NULL,
        is_second_audit TINYINT(1) DEFAULT 0,
        parent_session_id INT DEFAULT NULL,
        inherited_from_weekly VARCHAR(512),
        assigned_at DATETIME DEFAULT NULL,
        started_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_audit_type (audit_type),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_session_status`);
  }
}
