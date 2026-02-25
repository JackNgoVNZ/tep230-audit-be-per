import request from 'supertest';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: false, query: jest.fn() },
}));

import app from '../app';
import { AppDataSource } from '../config/database';

const mockQuery = AppDataSource.query as jest.Mock;

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
  mockQuery.mockReset();
});

describe('GET /api/users/:code/audit-history', () => {
  it('should return CHPI list with status from MySQL, total_score/threshold_result/completed_at as null', async () => {
    // MySQL: data query returns 2 CHPI rows (now includes status column)
    mockQuery.mockResolvedValueOnce([
      { code: 'CHPI-001', name: 'Onboard Audit 1', mychpttype: 'ONB-AUDIT', mychecker: 'USI-QA001', mycuievent: 'CUIE-001', status: 'Audited', created_at: '2025-01-15' },
      { code: 'CHPI-002', name: 'Weekly Audit 1', mychpttype: 'WKL-AUDIT', mychecker: 'USI-QA002', mycuievent: 'CUIE-002', status: 'Auditing', created_at: '2025-02-01' },
    ]);
    // MySQL: count query
    mockQuery.mockResolvedValueOnce([{ total: 2 }]);

    const res = await request(app)
      .get('/api/users/USI-TE001/audit-history')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    expect(res.body.data[0]).toMatchObject({
      code: 'CHPI-001',
      audit_type: 'ONB-AUDIT',
      status: 'Audited',
      total_score: null,
      threshold_result: null,
      completed_at: null,
    });
    expect(res.body.data[1]).toMatchObject({
      code: 'CHPI-002',
      audit_type: 'WKL-AUDIT',
      status: 'Auditing',
    });
  });

  it('should support ?type=ONB-AUDIT filter', async () => {
    mockQuery.mockResolvedValueOnce([
      { code: 'CHPI-001', name: 'Onboard Audit 1', mychpttype: 'ONB-AUDIT', mychecker: 'USI-QA001', mycuievent: 'CUIE-001', status: 'Audited', created_at: '2025-01-15' },
    ]);
    mockQuery.mockResolvedValueOnce([{ total: 1 }]);

    const res = await request(app)
      .get('/api/users/USI-TE001/audit-history?type=ONB-AUDIT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    // Verify the MySQL query included the type filter
    const dataQuery = mockQuery.mock.calls[0][0];
    expect(dataQuery).toContain('mychpttype');
    expect(mockQuery.mock.calls[0][1]).toContain('ONB-AUDIT');
  });

  it('should be paginated with meta', async () => {
    mockQuery.mockResolvedValueOnce([
      { code: 'CHPI-001', name: 'Audit 1', mychpttype: 'ONB-AUDIT', mychecker: 'USI-QA001', mycuievent: 'CUIE-001', status: 'Audited', created_at: '2025-01-15' },
    ]);
    mockQuery.mockResolvedValueOnce([{ total: 25 }]);

    const res = await request(app)
      .get('/api/users/USI-TE001/audit-history?page=2&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });
});
