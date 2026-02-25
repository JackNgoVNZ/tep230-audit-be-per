import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditFeedback1700000003 implements MigrationInterface {
  name = 'CreateAuditFeedback1700000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(128) NOT NULL UNIQUE,
        chpi_code VARCHAR(512) NOT NULL,
        gv_usi_code VARCHAR(128) NOT NULL,
        feedback_text TEXT NOT NULL,
        feedback_type VARCHAR(32) NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING',
        reviewer_usi_code VARCHAR(128) DEFAULT NULL,
        reviewer_note TEXT DEFAULT NULL,
        score_before DECIMAL(4,2) DEFAULT NULL,
        score_after DECIMAL(4,2) DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chpi_code (chpi_code),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_feedback`);
  }
}
