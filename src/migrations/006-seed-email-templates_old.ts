import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedEmailTemplates1700000006 implements MigrationInterface {
  name = 'SeedEmailTemplates1700000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO audit_email_template (code, name, subject, body_html, audit_type, trigger_status) VALUES
      ('EMAIL_AUDIT_COMPLETED', 'Audit Completed', 'Audit Result - {{audit_type}} - {{gv_name}}',
       '<h2>Audit Result</h2><p>Dear {{gv_name}},</p><p>Your {{audit_type}} audit has been completed.</p><p>Score: <strong>{{score}}/5.0</strong></p><p>Result: <strong>{{result}}</strong></p>',
       NULL, 'COMPLETED'),
      ('EMAIL_RETRAIN', 'Retrain Notification', 'Retrain Required - {{gv_name}}',
       '<h2>Retrain Required</h2><p>Dear {{gv_name}},</p><p>Based on your {{audit_type}} audit result (Score: {{score}}), you are required to undergo retraining.</p>',
       NULL, 'RETRAIN'),
      ('EMAIL_TERMINATE', 'Terminate Notification', 'Contract Termination - {{gv_name}}',
       '<h2>Contract Termination Notice</h2><p>Dear {{gv_name}},</p><p>Due to your audit results, your contract is being terminated.</p>',
       NULL, 'TERMINATE'),
      ('EMAIL_REMINDER', 'Audit Reminder', 'Audit Reminder - {{audit_type}}',
       '<h2>Audit Reminder</h2><p>Dear {{auditor_name}},</p><p>You have {{pending_count}} pending audit(s) to complete.</p>',
       NULL, 'REMINDER')
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM audit_email_template WHERE code IN ('EMAIL_AUDIT_COMPLETED', 'EMAIL_RETRAIN', 'EMAIL_TERMINATE', 'EMAIL_REMINDER')`);
  }
}
