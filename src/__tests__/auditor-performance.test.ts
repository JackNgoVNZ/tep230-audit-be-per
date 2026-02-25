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

describe('GET /api/auditors/:chriCode/performance', () => {
  it('should return performance stats from MySQL CHPI status', async () => {
    // MySQL: 3 CHPI records assigned to this auditor with status
    mockQuery.mockResolvedValueOnce([
      { code: 'CHPI-001', status: 'Audited' },
      { code: 'CHPI-002', status: 'Audited' },
      { code: 'CHPI-003', status: 'Auditing' },
    ]);

    const res = await request(app)
      .get('/api/auditors/USI-01/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats).toMatchObject({
      total_audits: 3,
      completed: 2,
      avg_score: 0,
      pass_count: 0,
      retrain_count: 0,
      terminate_count: 0,
    });
    expect(res.body.data.audits).toHaveLength(3);
  });

  it('should return all zeros for auditor with 0 audits', async () => {
    // MySQL: no CHPI records
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/auditors/USI-EMPTY/performance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats).toMatchObject({
      total_audits: 0,
      completed: 0,
      avg_score: 0,
      pass_count: 0,
      retrain_count: 0,
      terminate_count: 0,
    });
    expect(res.body.data.audits).toHaveLength(0);
  });
});
