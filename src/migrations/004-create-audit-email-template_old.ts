import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditEmailTemplate1700000004 implements MigrationInterface {
  name = 'CreateAuditEmailTemplate1700000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_email_template (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(128) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(512) NOT NULL,
        body_html TEXT NOT NULL,
        audit_type VARCHAR(32) DEFAULT NULL,
        trigger_status VARCHAR(32) DEFAULT NULL,
        published TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_email_template`);
  }
}
