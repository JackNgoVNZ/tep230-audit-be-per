import { LocalDataSource } from './local-database';
import { AuditThresholdConfig } from '../entities/audit-threshold-config.local-entity';
import { AuditEmailTemplate } from '../entities/audit-email-template.local-entity';
import { logger } from '../middleware/logger.middleware';

const THRESHOLD_SEEDS: Partial<AuditThresholdConfig>[] = [
  { code: 'ONBOARD_PASS',      audit_type: 'ONBOARD',  threshold_type: 'PASS',      min_score: 3.00, max_score: null,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'ONBOARD_RETRAIN',   audit_type: 'ONBOARD',  threshold_type: 'RETRAIN',   min_score: 2.29, max_score: 3.00,  has_second_audit: 1, has_unreg4: 0 },
  { code: 'ONBOARD_TERMINATE', audit_type: 'ONBOARD',  threshold_type: 'TERMINATE', min_score: null,  max_score: 2.29,  has_second_audit: 0, has_unreg4: 1 },
  { code: 'WEEKLY_PASS',       audit_type: 'WEEKLY',   threshold_type: 'PASS',      min_score: 3.00, max_score: null,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'WEEKLY_RETRAIN',    audit_type: 'WEEKLY',   threshold_type: 'RETRAIN',   min_score: 2.50, max_score: 3.00,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'WEEKLY_TERMINATE',  audit_type: 'WEEKLY',   threshold_type: 'TERMINATE', min_score: null,  max_score: 2.50,  has_second_audit: 0, has_unreg4: 1 },
  { code: 'HOTCASE_PASS',      audit_type: 'HOTCASE',  threshold_type: 'PASS',      min_score: 3.00, max_score: null,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'HOTCASE_RETRAIN',   audit_type: 'HOTCASE',  threshold_type: 'RETRAIN',   min_score: 2.50, max_score: 3.00,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'MONTHLY_PASS',      audit_type: 'MONTHLY',  threshold_type: 'PASS',      min_score: 3.00, max_score: null,  has_second_audit: 0, has_unreg4: 0 },
  { code: 'MONTHLY_RETRAIN',   audit_type: 'MONTHLY',  threshold_type: 'RETRAIN',   min_score: 2.29, max_score: 3.00,  has_second_audit: 1, has_unreg4: 0 },
  { code: 'MONTHLY_TERMINATE', audit_type: 'MONTHLY',  threshold_type: 'TERMINATE', min_score: null,  max_score: 2.29,  has_second_audit: 0, has_unreg4: 0 },
];

const EMAIL_TEMPLATE_SEEDS: Partial<AuditEmailTemplate>[] = [
  {
    code: 'EMAIL_AUDIT_COMPLETED',
    name: 'Audit Completed',
    subject: 'Kết quả Audit - {{audit_type}} - {{gv_name}}',
    body_html: `<h2>Kết quả Audit</h2>
<p>Xin chào {{gv_name}},</p>
<p>Kết quả audit <strong>{{audit_type}}</strong> của bạn đã hoàn tất.</p>
<p>Điểm số: <strong>{{score}}/5.0</strong></p>
<p>Kết quả: <strong>{{result}}</strong></p>
<p>Auditor: {{auditor_name}}</p>
<p>Ngày hoàn tất: {{completed_date}}</p>
<hr/>
<p><em>Hệ thống Clevai Audit System</em></p>`,
    trigger_status: 'COMPLETED',
  },
  {
    code: 'EMAIL_RETRAIN',
    name: 'Retrain Notification',
    subject: 'Yêu cầu Đào tạo lại - {{gv_name}}',
    body_html: `<h2>Thông báo Đào tạo lại</h2>
<p>Xin chào {{gv_name}},</p>
<p>Dựa trên kết quả audit <strong>{{audit_type}}</strong> (Điểm: {{score}}), bạn cần tham gia đào tạo lại.</p>
<p>Vui lòng liên hệ quản lý để biết thêm chi tiết.</p>
<hr/>
<p><em>Hệ thống Clevai Audit System</em></p>`,
    trigger_status: 'RETRAIN',
  },
  {
    code: 'EMAIL_TERMINATE',
    name: 'Terminate Notification',
    subject: 'Thông báo Chấm dứt Hợp đồng - {{gv_name}}',
    body_html: `<h2>Thông báo Chấm dứt Hợp đồng</h2>
<p>Xin chào {{gv_name}},</p>
<p>Do kết quả audit không đạt yêu cầu, hợp đồng của bạn sẽ bị chấm dứt.</p>
<p>Audit type: {{audit_type}}</p>
<p>Điểm: {{score}}/5.0</p>
<hr/>
<p><em>Hệ thống Clevai Audit System</em></p>`,
    trigger_status: 'TERMINATE',
  },
  {
    code: 'EMAIL_REMINDER',
    name: 'Audit Reminder',
    subject: 'Nhắc nhở Audit - {{audit_type}}',
    body_html: `<h2>Nhắc nhở Audit</h2>
<p>Xin chào {{auditor_name}},</p>
<p>Bạn có <strong>{{pending_count}}</strong> audit đang chờ xử lý.</p>
<p>Vui lòng hoàn tất trước deadline.</p>
<hr/>
<p><em>Hệ thống Clevai Audit System</em></p>`,
    trigger_status: 'REMINDER',
  },
  {
    code: 'EMAIL_FEEDBACK_RECEIVED',
    name: 'Feedback Received',
    subject: 'Phản hồi Audit mới - {{gv_name}}',
    body_html: `<h2>Phản hồi Audit</h2>
<p>GV <strong>{{gv_name}}</strong> đã gửi phản hồi về kết quả audit.</p>
<p>Loại phản hồi: {{feedback_type}}</p>
<p>Nội dung: {{feedback_text}}</p>
<hr/>
<p><em>Hệ thống Clevai Audit System</em></p>`,
    trigger_status: 'FEEDBACK',
  },
];

export async function seedLocalData(): Promise<void> {
  const thresholdRepo = LocalDataSource.getRepository(AuditThresholdConfig);
  const emailRepo = LocalDataSource.getRepository(AuditEmailTemplate);

  // Seed thresholds
  const existingThresholds = await thresholdRepo.count();
  if (existingThresholds === 0) {
    const now = new Date();
    const entities = THRESHOLD_SEEDS.map(s => {
      const e = new AuditThresholdConfig();
      Object.assign(e, s);
      e.published = 1;
      e.created_at = now;
      e.updated_at = now;
      return e;
    });
    await thresholdRepo.save(entities);
    logger.info(`Seeded ${entities.length} threshold configs`);
  }

  // Seed email templates
  const existingEmails = await emailRepo.count();
  if (existingEmails === 0) {
    const now = new Date();
    const entities = EMAIL_TEMPLATE_SEEDS.map(s => {
      const e = new AuditEmailTemplate();
      Object.assign(e, s);
      e.published = 1;
      e.created_at = now;
      e.updated_at = now;
      return e;
    });
    await emailRepo.save(entities);
    logger.info(`Seeded ${entities.length} email templates`);
  }
}
