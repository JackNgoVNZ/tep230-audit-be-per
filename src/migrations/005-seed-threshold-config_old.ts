import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedThresholdConfig1700000005 implements MigrationInterface {
  name = 'SeedThresholdConfig1700000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO audit_threshold_config (code, audit_type, threshold_type, min_score, max_score, has_second_audit, has_unreg4) VALUES
      ('ONBOARD_PASS',      'ONBOARD',  'PASS',      3.00, NULL, 0, 0),
      ('ONBOARD_RETRAIN',   'ONBOARD',  'RETRAIN',   2.29, 3.00, 1, 0),
      ('ONBOARD_TERMINATE', 'ONBOARD',  'TERMINATE', NULL, 2.29, 0, 1),
      ('WEEKLY_PASS',       'WEEKLY',   'PASS',      3.00, NULL, 0, 0),
      ('WEEKLY_RETRAIN',    'WEEKLY',   'RETRAIN',   2.50, 3.00, 0, 0),
      ('WEEKLY_TERMINATE',  'WEEKLY',   'TERMINATE', NULL, 2.50, 0, 1),
      ('HOTCASE_PASS',      'HOTCASE',  'PASS',      3.00, NULL, 0, 0),
      ('HOTCASE_RETRAIN',   'HOTCASE',  'RETRAIN',   2.50, 3.00, 0, 0),
      ('MONTHLY_PASS',      'MONTHLY',  'PASS',      3.00, NULL, 0, 0),
      ('MONTHLY_RETRAIN',   'MONTHLY',  'RETRAIN',   2.29, 3.00, 1, 0),
      ('MONTHLY_TERMINATE', 'MONTHLY',  'TERMINATE', NULL, 2.29, 0, 0)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM audit_threshold_config WHERE code LIKE '%PASS' OR code LIKE '%RETRAIN' OR code LIKE '%TERMINATE'`);
  }
}
