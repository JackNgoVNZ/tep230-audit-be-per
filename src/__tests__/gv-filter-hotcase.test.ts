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

const MOCK_HOTCASE_DATA = [
  {
    cuie_code: 'CUIE-HOT-001',
    hot_reason: 'Parent complaint',
    usi_code: 'USI-TE010',
    gv_name: 'Nguyen Van Hot',
    trigger_at: '2026-02-05 09:00:00',
  },
  {
    cuie_code: 'CUIE-HOT-002',
    hot_reason: 'Low rating',
    usi_code: 'USI-TE011',
    gv_name: 'Le Thi Nong',
    trigger_at: '2026-02-06 14:00:00',
  },
];

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/gv-filter/hotcase — data shape', () => {
  it('should return list with correct field names and pagination meta', async () => {
    mockQuery
      .mockResolvedValueOnce(MOCK_HOTCASE_DATA)
      .mockResolvedValueOnce([{ total: 2 }]);

    const res = await request(app)
      .get('/api/gv-filter/hotcase?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('cuie_code', 'CUIE-HOT-001');
    expect(res.body.data[0]).toHaveProperty('hot_reason', 'Parent complaint');
    expect(res.body.data[0]).toHaveProperty('usi_code', 'USI-TE010');
    expect(res.body.data[0]).toHaveProperty('gv_name', 'Nguyen Van Hot');
    expect(res.body.data[0]).toHaveProperty('trigger_at');
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('should return empty paginated list when no HOT events found', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    const res = await request(app)
      .get('/api/gv-filter/hotcase?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });
});

describe('GET /api/gv-filter/hotcase — SQL correctness', () => {
  it('should filter CUIE events with HOT type', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await request(app)
      .get('/api/gv-filter/hotcase?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[0][0] as string;
    expect(dataSql).toContain('mylcet_lceventtype');
    expect(dataSql).toContain('HOT');
    expect(dataSql).toContain('bp_cuie_details');
  });

  it('should exclude CUIE already processed into HOTCASE audits via LEFT JOIN + IS NULL', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await request(app)
      .get('/api/gv-filter/hotcase?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[0][0] as string;
    expect(dataSql).toContain('LEFT JOIN');
    expect(dataSql).toContain('bp_chpi_checkprocessitem');
    expect(dataSql).toContain('description');
    expect(dataSql).toContain('IS NULL');
  });

  it('should join USI to get teacher name and sort by trigger_at DESC', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await request(app)
      .get('/api/gv-filter/hotcase?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[0][0] as string;
    expect(dataSql).toContain('bp_usi_useritem');
    expect(dataSql).toContain('ORDER BY');
    expect(dataSql).toContain('trigger_at');
  });
});

describe('GET /api/gv-filter/hotcase — pagination', () => {
  it('should pass correct LIMIT and OFFSET for page=2&limit=5', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    const res = await request(app)
      .get('/api/gv-filter/hotcase?page=2&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const dataParams = mockQuery.mock.calls[0][1] as any[];
    expect(dataParams).toContain(5); // limit
    expect(dataParams).toContain(5); // offset = (2-1) * 5
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(5);
  });
});

describe('GET /api/gv-filter/hotcase — auth', () => {
  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/gv-filter/hotcase');
    expect(res.status).toBe(401);
  });
});
