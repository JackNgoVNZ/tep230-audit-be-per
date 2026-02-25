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

// 10 eligible TEs → 10% = 1 (CEIL), service will return CEIL(10*0.10) = 1
const MOCK_CAP_ROW = [
  { code: 'CAP-2026-W06', description: 'Week 06 2026', startperiod: '2026-02-02', endperiod: '2026-02-08' },
];

// Pool of eligible TEs with a random JSU each (returned by the combined query)
const MOCK_WEEKLY_DATA = [
  {
    usi_code: 'USI-TE001',
    gv_name: 'Nguyen Van A',
    selected_cuie_code: 'CUIE-JSU-101',
    trigger_at: '2026-02-03 09:00:00',
  },
  {
    usi_code: 'USI-TE002',
    gv_name: 'Tran Thi B',
    selected_cuie_code: 'CUIE-JSU-102',
    trigger_at: '2026-02-04 10:00:00',
  },
];

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/gv-filter/weekly — data shape', () => {
  it('should return weekly GV list with correct fields and pagination meta', async () => {
    mockQuery
      .mockResolvedValueOnce(MOCK_CAP_ROW)       // CAP lookup
      .mockResolvedValueOnce(MOCK_WEEKLY_DATA)    // data query
      .mockResolvedValueOnce([{ total: 2 }])      // count query
      .mockResolvedValueOnce([                     // enrich cuie batch
        { myusi: 'USI-TE001', cuie_code: 'CUIE-JSU-101', trigger_at: '2026-02-03 09:00:00' },
        { myusi: 'USI-TE002', cuie_code: 'CUIE-JSU-102', trigger_at: '2026-02-04 10:00:00' },
      ]);

    const res = await request(app)
      .get('/api/gv-filter/weekly?cap_week_code=CAP-2026-W06&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('usi_code', 'USI-TE001');
    expect(res.body.data[0]).toHaveProperty('gv_name', 'Nguyen Van A');
    expect(res.body.data[0]).toHaveProperty('selected_cuie_code', 'CUIE-JSU-101');
    expect(res.body.data[0]).toHaveProperty('trigger_at');
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('should return empty list when no eligible GV for the week', async () => {
    mockQuery
      .mockResolvedValueOnce(MOCK_CAP_ROW)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    const res = await request(app)
      .get('/api/gv-filter/weekly?cap_week_code=CAP-2026-W06&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });
});

describe('GET /api/gv-filter/weekly — SQL correctness', () => {
  it('should look up CAP date range by cap_week_code', async () => {
    mockQuery
      .mockResolvedValueOnce(MOCK_CAP_ROW)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await request(app)
      .get('/api/gv-filter/weekly?cap_week_code=CAP-2026-W06&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const capSql = mockQuery.mock.calls[0][0] as string;
    expect(capSql).toContain('bp_cap_calendarperiod');
    expect(capSql).toContain('code');
    const capParams = mockQuery.mock.calls[0][1];
    expect(capParams).toContain('CAP-2026-W06');
  });

  it('should filter JSU events within the CAP week date range', async () => {
    mockQuery
      .mockResolvedValueOnce(MOCK_CAP_ROW)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await request(app)
      .get('/api/gv-filter/weekly?cap_week_code=CAP-2026-W06&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('bp_cuie_details');
    expect(dataSql).toContain('JSU');
    expect(dataSql).toContain('trigger_at');
    expect(dataSql).toContain('bp_usi_useritem');
  });

  it('should exclude GV with existing WEEKLY CHPI via NOT EXISTS', async () => {
    mockQuery
      .mockResolvedValueOnce(MOCK_CAP_ROW)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await request(app)
      .get('/api/gv-filter/weekly?cap_week_code=CAP-2026-W06&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('NOT EXISTS');
    expect(dataSql).toContain('bp_chpi_checkprocessitem');
    expect(dataSql).toContain('WKL-AUDIT');
  });

  it('should use RAND() for random selection', async () => {
    mockQuery
      .mockResolvedValueOnce(MOCK_CAP_ROW)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await request(app)
      .get('/api/gv-filter/weekly?cap_week_code=CAP-2026-W06&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('RAND()');
  });
});

describe('GET /api/gv-filter/weekly — error handling', () => {
  it('should return 400 when cap_week_code is missing', async () => {
    const res = await request(app)
      .get('/api/gv-filter/weekly?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('should return 404 when CAP week not found', async () => {
    mockQuery.mockResolvedValueOnce([]); // empty CAP lookup

    const res = await request(app)
      .get('/api/gv-filter/weekly?cap_week_code=CAP-INVALID&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/gv-filter/weekly — auth', () => {
  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/gv-filter/weekly?cap_week_code=CAP-2026-W06');
    expect(res.status).toBe(401);
  });
});
