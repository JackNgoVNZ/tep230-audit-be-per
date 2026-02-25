import { LocalDataSource } from './local-database';
import { AuditThresholdConfig } from '../entities/audit-threshold-config.local-entity';
import { AuditEmailTemplate } from '../entities/audit-email-template.local-entity';

const THRESHOLD_SEEDS: Partial<AuditThresholdConfig>[] = [
  { code: 'ONB-AUDIT_PASS',      audit_type: 'ONB-AUDIT',  threshold_type: 'PASS',      min_score: 3.00, max_score: null,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'ONB-AUDIT_RETRAIN',   audit_type: 'ONB-AUDIT',  threshold_type: 'RETRAIN',   min_score: 2.29, max_score: 3.00,  has_second_audit: 1, has_unreg4: 0 },
  { code: 'ONB-AUDIT_TERMINATE', audit_type: 'ONB-AUDIT',  threshold_type: 'TERMINATE', min_score: null,  max_score: 2.29,  has_second_audit: 0, has_unreg4: 1 },
  { code: 'WKL-AUDIT_PASS',       audit_type: 'WKL-AUDIT',   threshold_type: 'PASS',      min_score: 3.00, max_score: null,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'WKL-AUDIT_RETRAIN',    audit_type: 'WKL-AUDIT',   threshold_type: 'RETRAIN',   min_score: 2.50, max_score: 3.00,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'WKL-AUDIT_TERMINATE',  audit_type: 'WKL-AUDIT',   threshold_type: 'TERMINATE', min_score: null,  max_score: 2.50,  has_second_audit: 0, has_unreg4: 1 },
  { code: 'HOT-AUDIT_PASS',      audit_type: 'HOT-AUDIT',  threshold_type: 'PASS',      min_score: 3.00, max_score: null,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'HOT-AUDIT_RETRAIN',   audit_type: 'HOT-AUDIT',  threshold_type: 'RETRAIN',   min_score: 2.50, max_score: 3.00,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'MTL-AUDIT_PASS',      audit_type: 'MTL-AUDIT',  threshold_type: 'PASS',      min_score: 3.00, max_score: null,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'MTL-AUDIT_RETRAIN',   audit_type: 'MTL-AUDIT',  threshold_type: 'RETRAIN',   min_score: 2.29, max_score: 3.00,  has_second_audit: 1, has_unreg4: 0 },
  { code: 'MTL-AUDIT_TERMINATE', audit_type: 'MTL-AUDIT',  threshold_type: 'TERMINATE', min_score: null,  max_score: 2.29,  has_second_audit: 0, has_unreg4: 0 },
];

const EMAIL_TEMPLATE_SEEDS: Partial<AuditEmailTemplate>[] = [
  {
    code: 'EMAIL_AUDIT_COMPLETED',
    name: 'Audit Completed',
    subject: 'Kết quả Audit - {{audit_type}} - {{gv_name}}',
    body_html: '<h2>Kết quả Audit</h2><p>Xin chào {{gv_name}},</p><p>Kết quả audit <strong>{{audit_type}}</strong> của bạn đã hoàn tất.</p><p>Điểm số: <strong>{{score}}/5.0</strong></p><p>Kết quả: <strong>{{result}}</strong></p>',
    trigger_status: 'COMPLETED',
  },
  {
    code: 'EMAIL_RETRAIN',
    name: 'Retrain Notification',
    subject: 'Yêu cầu Đào tạo lại - {{gv_name}}',
    body_html: '<h2>Thông báo Đào tạo lại</h2><p>Xin chào {{gv_name}},</p><p>Dựa trên kết quả audit <strong>{{audit_type}}</strong> (Điểm: {{score}}), bạn cần tham gia đào tạo lại.</p>',
    trigger_status: 'RETRAIN',
  },
  {
    code: 'EMAIL_TERMINATE',
    name: 'Terminate Notification',
    subject: 'Thông báo Chấm dứt Hợp đồng - {{gv_name}}',
    body_html: '<h2>Thông báo Chấm dứt Hợp đồng</h2><p>Xin chào {{gv_name}},</p><p>Do kết quả audit không đạt yêu cầu, hợp đồng của bạn sẽ bị chấm dứt.</p>',
    trigger_status: 'TERMINATE',
  },
  {
    code: 'EMAIL_REMINDER',
    name: 'Audit Reminder',
    subject: 'Nhắc nhở Audit - {{audit_type}}',
    body_html: '<h2>Nhắc nhở Audit</h2><p>Xin chào {{auditor_name}},</p><p>Bạn có <strong>{{pending_count}}</strong> audit đang chờ xử lý.</p>',
    trigger_status: 'REMINDER',
  },
  {
    code: 'EMAIL_FEEDBACK_RECEIVED',
    name: 'Feedback Received',
    subject: 'Phản hồi Audit mới - {{gv_name}}',
    body_html: '<h2>Phản hồi Audit</h2><p>GV <strong>{{gv_name}}</strong> đã gửi phản hồi về kết quả audit.</p>',
    trigger_status: 'FEEDBACK',
  },
];

export async function seedLocalData(): Promise<void> {
  const thresholdRepo = LocalDataSource.getRepository(AuditThresholdConfig);
  const emailRepo = LocalDataSource.getRepository(AuditEmailTemplate);

  const existingThresholds = await thresholdRepo.count();
  if (existingThresholds === 0) {
    const now = new Date();
    const entities = THRESHOLD_SEEDS.map((s) => {
      const e = new AuditThresholdConfig();
      Object.assign(e, s);
      e.published = 1;
      e.created_at = now;
      e.updated_at = now;
      return e;
    });
    await thresholdRepo.save(entities);
    console.log(`Seeded ${entities.length} threshold configs`);
  }

  const existingEmails = await emailRepo.count();
  if (existingEmails === 0) {
    const now = new Date();
    const entities = EMAIL_TEMPLATE_SEEDS.map((s) => {
      const e = new AuditEmailTemplate();
      Object.assign(e, s);
      e.published = 1;
      e.created_at = now;
      e.updated_at = now;
      return e;
    });
    await emailRepo.save(entities);
    console.log(`Seeded ${entities.length} email templates`);
  }
}
