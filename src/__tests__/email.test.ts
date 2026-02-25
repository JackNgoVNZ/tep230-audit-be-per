import request from 'supertest';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import app from '../app';
import { LocalDataSource } from '../config/local-database';

const mockLocalQuery = (LocalDataSource as any).query as jest.Mock;

async function getToken(username: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'audit@2024' });
  return res.body.access_token;
}

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockLocalQuery.mockReset();
});

// ---------- GET /api/email/templates ----------

describe('GET /api/email/templates', () => {
  it('should return list of email templates → 200', async () => {
    mockLocalQuery.mockResolvedValueOnce([
      { id: 1, code: 'EMAIL_AUDIT_COMPLETED', name: 'Audit Completed', subject: 'Kết quả Audit - {{audit_type}} - {{gv_name}}', body_html: '<h2>Kết quả</h2>', audit_type: null, trigger_status: 'COMPLETED', published: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 2, code: 'EMAIL_RETRAIN', name: 'Retrain Notification', subject: 'Yêu cầu Đào tạo lại - {{gv_name}}', body_html: '<h2>Retrain</h2>', audit_type: null, trigger_status: 'RETRAIN', published: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 3, code: 'EMAIL_TERMINATE', name: 'Terminate Notification', subject: 'Thông báo Chấm dứt - {{gv_name}}', body_html: '<h2>Terminate</h2>', audit_type: null, trigger_status: 'TERMINATE', published: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 4, code: 'EMAIL_REMINDER', name: 'Audit Reminder', subject: 'Nhắc nhở Audit - {{audit_type}}', body_html: '<h2>Reminder</h2>', audit_type: null, trigger_status: 'REMINDER', published: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 5, code: 'EMAIL_FEEDBACK_RECEIVED', name: 'Feedback Received', subject: 'Phản hồi Audit mới - {{gv_name}}', body_html: '<h2>Feedback</h2>', audit_type: null, trigger_status: 'FEEDBACK', published: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);

    const res = await request(app)
      .get('/api/email/templates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data[0].code).toBe('EMAIL_AUDIT_COMPLETED');
  });
});

// ---------- POST /api/email/templates ----------

describe('POST /api/email/templates', () => {
  it('should create a new email template → 201', async () => {
    // Check code uniqueness — returns empty (no duplicate)
    mockLocalQuery.mockResolvedValueOnce([]);
    // INSERT
    mockLocalQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/email/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'EMAIL_CUSTOM_TEST',
        name: 'Custom Test',
        subject: 'Test Subject',
        bodyHtml: '<p>Test body</p>',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('EMAIL_CUSTOM_TEST');
    expect(res.body.data.created).toBe(true);
  });
});

// ---------- PUT /api/email/templates/:id ----------

describe('PUT /api/email/templates/:id', () => {
  it('should update an existing template → 200', async () => {
    // Check exists
    mockLocalQuery.mockResolvedValueOnce([
      { id: 1, code: 'EMAIL_AUDIT_COMPLETED', name: 'Audit Completed', subject: 'Old Subject', body_html: '<h2>Old</h2>', published: 1 },
    ]);
    // UPDATE query
    mockLocalQuery.mockResolvedValueOnce([]);
    // Re-fetch updated row
    mockLocalQuery.mockResolvedValueOnce([
      { id: 1, code: 'EMAIL_AUDIT_COMPLETED', name: 'Audit Completed', subject: 'New Subject', body_html: '<h2>Old</h2>', published: 1 },
    ]);

    const res = await request(app)
      .put('/api/email/templates/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subject: 'New Subject' });

    expect(res.status).toBe(200);
    expect(res.body.data.subject).toBe('New Subject');
  });
});

// ---------- POST /api/email/send ----------

describe('POST /api/email/send', () => {
  it('should send email with resolved placeholders → 200', async () => {
    // Get template by code
    mockLocalQuery.mockResolvedValueOnce([
      {
        id: 1,
        code: 'EMAIL_AUDIT_COMPLETED',
        subject: 'Kết quả Audit - {{audit_type}} - {{gv_name}}',
        body_html: '<p>Xin chào {{gv_name}}, Điểm: {{score}}, Kết quả: {{result}}</p>',
        published: 1,
      },
    ]);

    const res = await request(app)
      .post('/api/email/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        templateCode: 'EMAIL_AUDIT_COMPLETED',
        recipientEmail: 'test@test.com',
        variables: {
          gv_name: 'Nguyen Van A',
          audit_type: 'ONB-AUDIT',
          score: '4.0',
          result: 'PASS',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
    expect(res.body.data.subject).toContain('ONB-AUDIT');
    expect(res.body.data.subject).toContain('Nguyen Van A');
  });

  it('should return 404 for invalid template code', async () => {
    // Template not found
    mockLocalQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/email/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        templateCode: 'INVALID_CODE',
        recipientEmail: 'test@test.com',
      });

    expect(res.status).toBe(404);
  });
});
