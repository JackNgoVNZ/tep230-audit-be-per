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

const MOCK_CHPI = {
  code: 'CHPI_ONBOARD_CUIE001_20260201_ab12',
  name: 'Onboard Process',
  description: 'CUIE-JSU-001',
  mychpt: 'PT1-GG1-GE',
  mychpttype: 'ONB-AUDIT',
  mytrigger: 'USI-TE001',
  mychecker: null,
  created_at: '2026-02-01 10:00:00',
};

const MOCK_USI = {
  code: 'USI-TE001',
  fullname: 'Nguyen Van A',
  email: 'a@clevai.vn',
  myust: 'TE',
};

const MOCK_CUIE = {
  code: 'CUIE-JSU-001',
  mylcet_lceventtype: 'JSU',
  trigger_at: '2026-01-20 10:00:00',
  myusi: 'USI-TE001',
};

const MOCK_CHSI_ROWS = [
  { code: 'CHSI_01', name: 'Step 1', checksample: 3, mychpi: 'CHPI_ONBOARD_CUIE001_20260201_ab12', mychst: 'CHST-01' },
  { code: 'CHSI_02', name: 'Step 2', checksample: 2, mychpi: 'CHPI_ONBOARD_CUIE001_20260201_ab12', mychst: 'CHST-02' },
];

const MOCK_CHLI_STEP1 = [
  { code: 'CHLI_01', name: 'Item 1', mychsi: 'CHSI_01', myparentchlt: null, scoretype1: 'SCALE', score1: null },
  { code: 'CHLI_02', name: 'Item 2', mychsi: 'CHSI_01', myparentchlt: 'CHLT-01', scoretype1: 'BINARY', score1: null },
];

const MOCK_CHLI_STEP2 = [
  { code: 'CHLI_03', name: 'Item 3', mychsi: 'CHSI_02', myparentchlt: null, scoretype1: 'SCALE', score1: null },
];

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/audit-processes/:code — detail', () => {
  it('should return full detail with CHPI, GV info, CUIE info, steps with checklist items', async () => {
    mockQuery
      .mockResolvedValueOnce([MOCK_CHPI])       // 1. CHPI lookup (now includes description)
      .mockResolvedValueOnce([MOCK_USI])         // 2. USI (GV info)
      .mockResolvedValueOnce([MOCK_CUIE])        // 3. CUIE event info from bp_cuie_details
      .mockResolvedValueOnce(MOCK_CHSI_ROWS)     // 4. CHSI steps
      .mockResolvedValueOnce(MOCK_CHLI_STEP1)    // 5. CHLI for step 1
      .mockResolvedValueOnce(MOCK_CHLI_STEP2);   // 6. CHLI for step 2

    const res = await request(app)
      .get(`/api/audit-processes/${MOCK_CHPI.code}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;

    // CHPI fields
    expect(data.code).toBe(MOCK_CHPI.code);
    expect(data.audit_type).toBe('ONB-AUDIT');
    expect(data.name).toBe('Onboard Process');

    // GV info
    expect(data.gv).toMatchObject({
      code: 'USI-TE001',
      fullname: 'Nguyen Van A',
      email: 'a@clevai.vn',
    });

    // CUIE event info
    expect(data.cuie).toMatchObject({
      code: 'CUIE-JSU-001',
      trigger_at: '2026-01-20 10:00:00',
    });

    // Steps with checklist items
    expect(data.steps).toHaveLength(2);
    expect(data.steps[0].code).toBe('CHSI_01');
    expect(data.steps[0].name).toBe('Step 1');
    expect(data.steps[0].items).toHaveLength(2);
    expect(data.steps[0].items[0].code).toBe('CHLI_01');

    expect(data.steps[1].code).toBe('CHSI_02');
    expect(data.steps[1].items).toHaveLength(1);
  });

  it('should return 404 for nonexistent CHPI code', async () => {
    mockQuery.mockResolvedValueOnce([]); // CHPI not found

    const res = await request(app)
      .get('/api/audit-processes/NONEXISTENT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app)
      .get(`/api/audit-processes/${MOCK_CHPI.code}`);

    expect(res.status).toBe(401);
  });
});
