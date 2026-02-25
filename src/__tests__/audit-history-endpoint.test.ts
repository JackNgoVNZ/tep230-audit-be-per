import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import app from '../app';
import { AppDataSource } from '../config/database';

const mockQuery = AppDataSource.query as jest.Mock;

function makeToken(role: string, code = 'TEST_USER'): string {
  return jwt.sign(
    { usi_code: code, fullname: 'Test User', myust: role },
    'default-jwt-secret',
    { expiresIn: 86400 }
  );
}

let token: string;

beforeAll(() => {
  token = makeToken('AD');
});

beforeEach(() => {
  mockQuery.mockReset();
});

const CHPI_ROWS = [
  { code: 'CHPI_001', audit_type: 'ONB-AUDIT', teacher_name: 'Teacher A', auditor_name: 'Auditor 1', status: 'Audited', created_at: '2026-02-01' },
  { code: 'CHPI_002', audit_type: 'WKL-AUDIT', teacher_name: 'Teacher B', auditor_name: 'Auditor 2', status: 'Audited', created_at: '2026-02-05' },
];

function setupHistoryMocks(chpiRows = CHPI_ROWS) {
  // 1. MySQL COUNT query
  mockQuery.mockResolvedValueOnce([{ cnt: chpiRows.length }]);
  if (chpiRows.length === 0) return;
  // 2. MySQL data rows
  mockQuery.mockResolvedValueOnce(chpiRows);
}

describe('GET /api/audit-processes/history', () => {
  it('returns paginated results', async () => {
    setupHistoryMocks();

    const res = await request(app)
      .get('/api/audit-processes/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('filter by teacher returns matching audits', async () => {
    setupHistoryMocks();

    const res = await request(app)
      .get('/api/audit-processes/history?teacher=Teacher%20A')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify the SQL includes teacher filter
    const allSqls = mockQuery.mock.calls.map((c: any[]) => c[0] as string).join(' ');
    expect(allSqls).toContain('gv.fullname LIKE');
  });

  it('filter by auditor returns matching audits', async () => {
    setupHistoryMocks();

    const res = await request(app)
      .get('/api/audit-processes/history?auditor=Auditor%201')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const allSqls = mockQuery.mock.calls.map((c: any[]) => c[0] as string).join(' ');
    expect(allSqls).toContain('aud.fullname LIKE');
  });

  it('filter by date range works', async () => {
    setupHistoryMocks();

    const res = await request(app)
      .get('/api/audit-processes/history?fromDate=2026-02-01&toDate=2026-02-28')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const allSqls = mockQuery.mock.calls.map((c: any[]) => c[0] as string).join(' ');
    expect(allSqls).toContain('created_at >=');
    expect(allSqls).toContain('created_at <=');
  });

  it('filter by pt works', async () => {
    setupHistoryMocks();

    const res = await request(app)
      .get('/api/audit-processes/history?pt=PT1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const allSqls = mockQuery.mock.calls.map((c: any[]) => c[0] as string).join(' ');
    expect(allSqls).toContain('chpt.mypt');
  });

  it('returns data with correct fields', async () => {
    setupHistoryMocks();

    const res = await request(app)
      .get('/api/audit-processes/history')
      .set('Authorization', `Bearer ${token}`);

    const item = res.body.data[0];
    expect(item).toHaveProperty('code');
    expect(item).toHaveProperty('audit_type');
    expect(item).toHaveProperty('teacher_name');
    expect(item).toHaveProperty('auditor_name');
    expect(item).toHaveProperty('status');
    expect(item).toHaveProperty('created_at');
  });

  it('all 4 roles can access', async () => {
    for (const role of ['AD', 'TO', 'QS', 'QA']) {
      const tk = makeToken(role);
      setupHistoryMocks();

      const res = await request(app)
        .get('/api/audit-processes/history')
        .set('Authorization', `Bearer ${tk}`);

      expect(res.status).toBe(200);
    }
  });
});
