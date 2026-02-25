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

const MOCK_CAP_ROW = [
  { code: 'CAP-2026-M02', description: 'February 2026', startperiod: '2026-02-01', endperiod: '2026-02-28' },
];

// GV with completed WEEKLY -> INHERIT_WEEKLY
const MOCK_WEEKLY_INHERITED = [
  {
    usi_code: 'USI-TE001',
    gv_name: 'Nguyen Van A',
    weekly_chpi_code: 'CHPI_WEEKLY_001',
  },
];

// GV without WEEKLY but with JSU -> NEW_AUDIT
const MOCK_NEW_AUDIT_GVS = [
  {
    usi_code: 'USI-TE002',
    gv_name: 'Tran Thi B',
    selected_cuie_code: null,
    trigger_at: null,
  },
];

// CUIE enrichment for new audit GVs
const MOCK_NEW_CUIE_ENRICH = [
  {
    myusi: 'USI-TE002',
    cuie_code: 'CUIE-JSU-201',
    trigger_at: '2026-02-10 09:00:00',
    mypt: 'PT1',
    mygg: 'GG1',
    mylcp: 'LCP1',
  },
];

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

/**
 * Standard mock setup for a successful monthly call (MySQL only, no SQLite):
 * 1. CAP lookup (MySQL)
 * 2. Inherited WEEKLY GVs (MySQL)
 * 3. New audit GVs (MySQL)
 * 4. CUIE enrichment for new rows (MySQL) — only if newAudit.length > 0
 * 5. Count query (MySQL)
 */
function setupMocks(opts?: {
  capRow?: any[];
  inherited?: any[];
  newAudit?: any[];
  newCuieEnrich?: any[];
  total?: number;
}) {
  const {
    capRow = MOCK_CAP_ROW,
    inherited = MOCK_WEEKLY_INHERITED,
    newAudit = MOCK_NEW_AUDIT_GVS,
    newCuieEnrich = MOCK_NEW_CUIE_ENRICH,
    total = 2,
  } = opts || {};

  mockQuery
    .mockResolvedValueOnce(capRow)            // 1. CAP lookup
    .mockResolvedValueOnce(inherited)         // 2. WEEKLY inherited GVs
    .mockResolvedValueOnce(newAudit);         // 3. New audit GVs

  // 4. CUIE enrichment — only happens if newAudit has rows
  if (newAudit.length > 0) {
    mockQuery.mockResolvedValueOnce(newCuieEnrich);
  }

  // 5. Count query
  mockQuery.mockResolvedValueOnce([{ total }]);
}

describe('GET /api/gv-filter/monthly — data shape', () => {
  it('should return mixed list with INHERIT_WEEKLY and NEW_AUDIT sources', async () => {
    setupMocks();

    const res = await request(app)
      .get('/api/gv-filter/monthly?cap_month_code=CAP-2026-M02&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    // Inherited GV
    const inherited = res.body.data.find((d: any) => d.usi_code === 'USI-TE001');
    expect(inherited).toBeDefined();
    expect(inherited.source).toBe('INHERIT_WEEKLY');
    expect(inherited.weekly_chpi_code).toBe('CHPI_WEEKLY_001');
    // No SQLite scores anymore
    expect(inherited.weekly_score).toBeNull();

    // New audit GV
    const newAudit = res.body.data.find((d: any) => d.usi_code === 'USI-TE002');
    expect(newAudit).toBeDefined();
    expect(newAudit.source).toBe('NEW_AUDIT');
    expect(newAudit.selected_cuie_code).toBe('CUIE-JSU-201');
  });

  it('should return empty list when no eligible GV for the month', async () => {
    setupMocks({ inherited: [], newAudit: [], newCuieEnrich: [], total: 0 });

    const res = await request(app)
      .get('/api/gv-filter/monthly?cap_month_code=CAP-2026-M02&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });
});

describe('GET /api/gv-filter/monthly — SQL correctness', () => {
  it('should look up CAP month by cap_month_code', async () => {
    setupMocks();

    await request(app)
      .get('/api/gv-filter/monthly?cap_month_code=CAP-2026-M02&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const capSql = mockQuery.mock.calls[0][0] as string;
    expect(capSql).toContain('bp_cap_calendarperiod');
    const capParams = mockQuery.mock.calls[0][1];
    expect(capParams).toContain('CAP-2026-M02');
  });

  it('should query for GVs with WEEKLY CHPI in the month', async () => {
    setupMocks();

    await request(app)
      .get('/api/gv-filter/monthly?cap_month_code=CAP-2026-M02&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const inheritSql = mockQuery.mock.calls[1][0] as string;
    expect(inheritSql).toContain('bp_chpi_checkprocessitem');
    expect(inheritSql).toContain('WKL-AUDIT');
    expect(inheritSql).toContain('bp_usi_useritem');
  });

  it('should not use SQLite for session scores (all MySQL)', async () => {
    setupMocks();

    await request(app)
      .get('/api/gv-filter/monthly?cap_month_code=CAP-2026-M02&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    // All queries should be through mockQuery (MySQL), no SQLite calls
    const allSqls = mockQuery.mock.calls.map((c: any[]) => c[0] as string).join(' ');
    expect(allSqls).not.toContain('audit_session_status');
  });

  it('should query for GVs without WEEKLY but with JSU in month', async () => {
    setupMocks();

    await request(app)
      .get('/api/gv-filter/monthly?cap_month_code=CAP-2026-M02&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    const newSql = mockQuery.mock.calls[2][0] as string;
    expect(newSql).toContain('bp_cuie_details');
    expect(newSql).toContain('JSU');
    expect(newSql).toContain('bp_usi_useritem');
  });
});

describe('GET /api/gv-filter/monthly — error handling', () => {
  it('should return 400 when cap_month_code is missing', async () => {
    const res = await request(app)
      .get('/api/gv-filter/monthly?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('should return 404 when CAP month not found', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/gv-filter/monthly?cap_month_code=CAP-INVALID&page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/gv-filter/monthly — auth', () => {
  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/gv-filter/monthly?cap_month_code=CAP-2026-M02');
    expect(res.status).toBe(401);
  });
});
