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

const SAMPLE_CHPT = [
  { id: 1, code: 'CHPT-001', name: 'Onboard Audit Process', published: 1, created_at: '2024-01-01' },
  { id: 2, code: 'CHPT-002', name: 'Weekly Audit Process', published: 1, created_at: '2024-01-01' },
];

const SAMPLE_CHST = [
  { id: 1, code: 'CHST-001', name: 'Step 1', mychpt: 'CHPT-001', checksample: 5, published: 1 },
  { id: 2, code: 'CHST-002', name: 'Step 2', mychpt: 'CHPT-001', checksample: 3, published: 1 },
];

const SAMPLE_CHLT = [
  { id: 1, code: 'CHLT-001', name: 'Criteria 1', mychst: 'CHST-001', scoretype: 'PASS_FAIL', published: 1 },
  { id: 2, code: 'CHLT-002', name: 'Criteria 2', mychst: 'CHST-001', scoretype: 'SCORE', published: 1 },
];

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/settings/chpt — process templates', () => {
  it('should return paginated CHPT list with meta', async () => {
    mockQuery
      .mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]) // hasMyptMygg check
      .mockResolvedValueOnce(SAMPLE_CHPT)
      .mockResolvedValueOnce([{ total: 102 }]);

    const res = await request(app)
      .get('/api/settings/chpt?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 102, totalPages: 6 });
  });
});

describe('GET /api/settings/chst — step templates', () => {
  it('should return CHST list filtered by chptCode', async () => {
    mockQuery
      .mockResolvedValueOnce(SAMPLE_CHST)
      .mockResolvedValueOnce([{ total: 2 }]);

    const res = await request(app)
      .get('/api/settings/chst?chptCode=CHPT-001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    // Verify filter was applied in SQL
    const dataCall = mockQuery.mock.calls[0];
    expect(dataCall[0]).toContain('mychpt');
    expect(dataCall[1]).toContain('CHPT-001');
  });
});

describe('GET /api/settings/chlt — checklist templates', () => {
  it('should return CHLT list filtered by chstCode', async () => {
    mockQuery
      .mockResolvedValueOnce(SAMPLE_CHLT)
      .mockResolvedValueOnce([{ total: 2 }]);

    const res = await request(app)
      .get('/api/settings/chlt?chstCode=CHST-001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    const dataCall = mockQuery.mock.calls[0];
    expect(dataCall[0]).toContain('mychst');
    expect(dataCall[1]).toContain('CHST-001');
  });
});

describe('Settings endpoints — auth', () => {
  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/settings/chpt');
    expect(res.status).toBe(401);
  });
});
