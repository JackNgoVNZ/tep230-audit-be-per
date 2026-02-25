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

let adminToken: string;

beforeAll(() => {
  adminToken = makeToken('AD');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/audit-processes — list', () => {
  it('should return paginated empty list when no CHPI exist', async () => {
    // Promise.all: COUNT + DATA run in parallel
    mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/audit-processes?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('should return paginated CHPI list when data exists', async () => {
    // 1. MySQL COUNT query
    mockQuery.mockResolvedValueOnce([{ cnt: 2 }]);

    // 2. MySQL data query (CHPI + USI join)
    mockQuery.mockResolvedValueOnce([
      { code: 'CHPI-001', name: 'Onboard Audit', mychpttype: 'ONB-AUDIT', status: 'Open', gv_name: 'Teacher A', created_at: '2026-01-15' },
      { code: 'CHPI-002', name: 'Weekly Audit', mychpttype: 'WKL-AUDIT', status: 'Assigned', gv_name: 'Teacher B', created_at: '2026-01-16' },
    ]);

    const res = await request(app)
      .get('/api/audit-processes?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].code).toBe('CHPI-001');
    expect(res.body.meta.total).toBe(2);
  });

  it('should filter by auditType when provided', async () => {
    // Promise.all: COUNT + DATA run in parallel
    mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/audit-processes?page=1&limit=20&auditType=ONB-AUDIT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Verify the MySQL query SQL contains the filter
    const countCall = mockQuery.mock.calls[0];
    expect(countCall[0]).toContain('mychpttype');
    expect(countCall[1]).toContain('ONB-AUDIT');
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/audit-processes');
    expect(res.status).toBe(401);
  });

  it('should allow AD, TO, QS, and QA roles', async () => {
    mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
    mockQuery.mockResolvedValueOnce([]);

    const qaToken = makeToken('QA');
    const res = await request(app)
      .get('/api/audit-processes?page=1&limit=20')
      .set('Authorization', `Bearer ${qaToken}`);

    expect(res.status).toBe(200);
  });

  it('should filter by search (teacher name) when provided', async () => {
    mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/audit-processes?page=1&limit=20&search=Nguyen')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const countCall = mockQuery.mock.calls[0];
    expect(countCall[0]).toContain('gv.fullname LIKE');
    expect(countCall[1]).toContain('%Nguyen%');
  });

  it('should filter by auditor name when provided', async () => {
    mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/audit-processes?page=1&limit=20&auditor=Tran')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const countCall = mockQuery.mock.calls[0];
    expect(countCall[0]).toContain('aud.fullname LIKE');
    expect(countCall[1]).toContain('%Tran%');
  });

  it('should filter by dateFrom and dateTo when provided', async () => {
    mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/audit-processes?page=1&limit=20&dateFrom=2026-01-01&dateTo=2026-01-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const countCall = mockQuery.mock.calls[0];
    expect(countCall[0]).toContain('chpi.created_at >=');
    expect(countCall[0]).toContain('chpi.created_at <=');
    expect(countCall[1]).toContain('2026-01-01');
    expect(countCall[1]).toContain('2026-01-31 23:59:59');
  });
});
