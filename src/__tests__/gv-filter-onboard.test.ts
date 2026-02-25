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

// ---------- Mock Data (matches new SELECT aliases) ----------

function makeRow1() {
  return {
    chpi_code: 'ULC-001_ONB-AUDIT_USI-TE001_abc123',
    usi_code: 'USI-TE001',
    chpi_status: 'Assigned',
    auditor_code: 'USI-AU001',
    myulc: 'ULC-001',
    myclag: 'CLAG-001',
    cuie_code: 'CUIE-001',
    created_at: '2026-02-19 08:00:00',
    fullname: 'Nguyen Van A',
    auditor_name: 'Auditor X',
    mypt: 'DLC',
    mygg: 'K1',
    mylcp: 'LCP-01',
    capstart: '2026-02-01 00:00:00',
  };
}

function makeRow2() {
  return {
    chpi_code: 'ULC-002_ONB-AUDIT_USI-TE002_def456',
    usi_code: 'USI-TE002',
    chpi_status: 'Assigned',
    auditor_code: null,
    myulc: 'ULC-002',
    myclag: 'CLAG-002',
    cuie_code: 'CUIE-010',
    created_at: '2026-02-20 09:00:00',
    fullname: 'Tran Thi B',
    auditor_name: null,
    mypt: 'ENG',
    mygg: 'K2',
    mylcp: 'LCP-02',
    capstart: '2026-02-01 00:00:00',
  };
}

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

// ================================================================
// 1. SQL: query bp_chpi JOIN ULC + CAP (no audit_session_status)
// ================================================================

describe('GET /api/gv-filter/onboard — SQL criteria', () => {
  it('should query bp_chpi_checkprocessitem JOIN ULC and CAP', async () => {
    // Promise.all: [countQuery, dataQuery]
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])  // count
      .mockResolvedValueOnce([]);              // data

    await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    // count is call[0], data is call[1]
    const countSql = mockQuery.mock.calls[0][0] as string;
    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(countSql).toContain('bp_chpi_checkprocessitem');
    expect(dataSql).toContain('bp_chpi_checkprocessitem');
    expect(dataSql).toContain('bp_ulc_uniquelearningcomponent');
    expect(dataSql).toContain('bp_cap_calendarperiod');
    expect(dataSql).toContain("mychpttype = 'ONB-AUDIT'");
  });

  it('should NOT query audit_session_status or bp_cuie_details', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const countSql = mockQuery.mock.calls[0][0] as string;
    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).not.toContain('audit_session_status');
    expect(dataSql).not.toContain('bp_cuie_details');
    expect(countSql).not.toContain('audit_session_status');
    expect(countSql).not.toContain('bp_cuie_details');
  });

  it('should JOIN bp_usi_useritem for teacher and auditor names', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[1][0] as string;
    // Should join USI twice: once for teacher (gv), once for auditor (aud)
    expect(dataSql).toContain('bp_usi_useritem gv');
    expect(dataSql).toContain('bp_usi_useritem aud');
  });
});

// ================================================================
// 2. Data enrichment — fullname from JOINs (no separate batch lookup)
// ================================================================

describe('GET /api/gv-filter/onboard — data enrichment', () => {
  it('should return fullname from JOIN (no separate USI batch lookup)', async () => {
    const row = makeRow1();
    mockQuery
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([row]);

    const res = await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const item = res.body.data[0];
    expect(item.fullname).toBe('Nguyen Van A');
    expect(item.usi_code).toBe('USI-TE001');
    expect(item.auditor_name).toBe('Auditor X');

    // Only 2 DB calls (count + data), no batch USI lookup
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('should derive audit_status: Open when auditor_code is null', async () => {
    const row = makeRow2(); // auditor_code = null
    mockQuery
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([row]);

    const res = await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].audit_status).toBe('Open');
  });

  it('should derive audit_status from chpi_status when auditor is assigned', async () => {
    const row = makeRow1(); // auditor_code = 'USI-AU001', chpi_status = 'Assigned'
    mockQuery
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([row]);

    const res = await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].audit_status).toBe('Assigned');
  });

  it('should return PT/GG/LCP/capstart from ULC+CAP JOINs', async () => {
    const row = makeRow1();
    mockQuery
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([row]);

    const res = await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const item = res.body.data[0];
    expect(item.mypt).toBe('DLC');
    expect(item.mygg).toBe('K1');
    expect(item.mylcp).toBe('LCP-01');
    expect(item.capstart).toBe('2026-02-01 00:00:00');
  });
});

// ================================================================
// 3. Response shape
// ================================================================

describe('GET /api/gv-filter/onboard — response shape', () => {
  it('should return all required fields', async () => {
    const row = makeRow1();
    mockQuery
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([row]);

    const res = await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const item = res.body.data[0];
    expect(item).toHaveProperty('chpi_code');
    expect(item).toHaveProperty('usi_code');
    expect(item).toHaveProperty('chpi_status');
    expect(item).toHaveProperty('auditor_code');
    expect(item).toHaveProperty('fullname');
    expect(item).toHaveProperty('auditor_name');
    expect(item).toHaveProperty('mypt');
    expect(item).toHaveProperty('mygg');
    expect(item).toHaveProperty('mylcp');
    expect(item).toHaveProperty('capstart');
    expect(item).toHaveProperty('audit_status');
    expect(item).toHaveProperty('first_jsu_cuie_code');

    // Pagination meta
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('should return empty list when no ONB-AUDIT items', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });
});

// ================================================================
// 4. Pagination
// ================================================================

describe('GET /api/gv-filter/onboard — pagination', () => {
  it('should pass correct LIMIT and OFFSET for page=2&limit=5', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 10 }])
      .mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/gv-filter/onboard?page=2&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Data query is call[1]; params = [...filterParams, limit, offset]
    const dataParams = mockQuery.mock.calls[1][1] as any[];
    const lastTwo = dataParams.slice(-2);
    expect(lastTwo[0]).toBe(5);  // limit
    expect(lastTwo[1]).toBe(5);  // offset = (2-1)*5
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(5);
  });
});

// ================================================================
// 5. Filters
// ================================================================

describe('GET /api/gv-filter/onboard — filters', () => {
  it('should add PT filter condition when pt param is provided', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20&pt=DLC')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('ulc.mypt IN (?)');
    const dataParams = mockQuery.mock.calls[1][1] as any[];
    expect(dataParams).toContain('DLC');
  });

  it('should add GG filter condition when gg param is provided', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20&gg=K1')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('ulc.mygg IN (?)');
    const dataParams = mockQuery.mock.calls[1][1] as any[];
    expect(dataParams).toContain('K1');
  });

  it('should filter Open status (mychecker IS NULL)', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20&status=Open')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('chpi.mychecker IS NULL');
  });

  it('should filter by search (fullname or code LIKE)', async () => {
    mockQuery
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await request(app)
      .get('/api/gv-filter/onboard?page=1&limit=20&search=Nguyen')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataSql = mockQuery.mock.calls[1][0] as string;
    expect(dataSql).toContain('gv.fullname LIKE ?');
    const dataParams = mockQuery.mock.calls[1][1] as any[];
    expect(dataParams).toContain('%Nguyen%');
  });
});

// ================================================================
// 6. Auth
// ================================================================

describe('GET /api/gv-filter/onboard — auth', () => {
  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/gv-filter/onboard');
    expect(res.status).toBe(401);
  });
});

// ================================================================
// 7. PATCH /audit-processes/:code/start
// ================================================================

describe('PATCH /api/audit-processes/:code/start', () => {
  it('should transition PENDING → AUDITING and return chpi_code', async () => {
    // Verify CHPI exists (AppDataSource)
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_ONBOARD_abc' }]);
    // UPDATE audit_session_status (now via AppDataSource.query)
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .patch('/api/audit-processes/CHPI_ONBOARD_abc/start')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.chpi_code).toBe('CHPI_ONBOARD_abc');

    // Verify UPDATE SQL contains PENDING → AUDITING
    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toContain("status = 'AUDITING'");
    expect(updateSql).toContain("status = 'PENDING'");
    expect(updateSql).toContain('started_at');
  });

  it('should return 404 when CHPI does not exist', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/api/audit-processes/NONEXISTENT/start')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 409 when audit is not in PENDING status', async () => {
    // CHPI exists (AppDataSource)
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_ONBOARD_abc' }]);
    // UPDATE returns 0 affected rows (already AUDITING or COMPLETED) via AppDataSource
    mockQuery.mockResolvedValueOnce({ affectedRows: 0 });

    const res = await request(app)
      .patch('/api/audit-processes/CHPI_ONBOARD_abc/start')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app)
      .patch('/api/audit-processes/CHPI_ONBOARD_abc/start');
    expect(res.status).toBe(401);
  });
});
