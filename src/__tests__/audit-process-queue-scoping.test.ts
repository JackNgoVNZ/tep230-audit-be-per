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
let mgrToken: string;
let qalToken: string;
let qaToken: string;

beforeAll(() => {
  adminToken = makeToken('AD');
  mgrToken = makeToken('TO');
  qalToken = makeToken('QS', 'USI-QAL001');
  qaToken = makeToken('QA', 'USI-QA001');
});

beforeEach(() => {
  mockQuery.mockReset();
});

function setupListMocks(count: number, chpiRows: any[]) {
  // Promise.all: COUNT + DATA run in parallel (both always execute)
  mockQuery.mockResolvedValueOnce([{ cnt: count }]);
  mockQuery.mockResolvedValueOnce(chpiRows);
}

const CHPI_ROWS = [
  { code: 'CHPI_001', name: 'Audit 1', mychpttype: 'ONB-AUDIT', mytrigger: 'USI-TE001', mychecker: 'USI-QA01', status: 'Open', created_at: '2026-02-01', gv_name: 'Teacher A' },
  { code: 'CHPI_002', name: 'Audit 2', mychpttype: 'ONB-AUDIT', mytrigger: 'USI-TE002', mychecker: 'USI-QA02', status: 'Assigned', created_at: '2026-02-02', gv_name: 'Teacher B' },
];

describe('GET /api/audit-processes — role-based queue scoping', () => {
  it('QA sees only sessions where mychecker matches their usi_code', async () => {
    // QA user (auditor) has usi_code=USI-QA001
    setupListMocks(1, [CHPI_ROWS[0]]);

    const res = await request(app)
      .get('/api/audit-processes')
      .set('Authorization', `Bearer ${qaToken}`);

    expect(res.status).toBe(200);

    // Verify the SQL includes mychecker filter
    const allSqls = mockQuery.mock.calls.map((call: any[]) => call[0] as string).join(' ');
    expect(allSqls).toContain('mychecker');
  });

  it('ADM sees all sessions (no mychecker filter)', async () => {
    setupListMocks(2, CHPI_ROWS);

    const res = await request(app)
      .get('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Verify the SQL does NOT include mychecker filter
    const allSqls = mockQuery.mock.calls.map((call: any[]) => call[0] as string).join(' ');
    expect(allSqls).not.toContain('mychecker =');
  });

  it('TO sees all sessions (no mychecker filter)', async () => {
    setupListMocks(2, CHPI_ROWS);

    const res = await request(app)
      .get('/api/audit-processes')
      .set('Authorization', `Bearer ${mgrToken}`);

    expect(res.status).toBe(200);

    const allSqls = mockQuery.mock.calls.map((call: any[]) => call[0] as string).join(' ');
    expect(allSqls).not.toContain('mychecker =');
  });

  it('QS sees all sessions (no mychecker filter)', async () => {
    setupListMocks(2, CHPI_ROWS);

    const res = await request(app)
      .get('/api/audit-processes')
      .set('Authorization', `Bearer ${qalToken}`);

    expect(res.status).toBe(200);

    const allSqls = mockQuery.mock.calls.map((call: any[]) => call[0] as string).join(' ');
    expect(allSqls).not.toContain('mychecker =');
  });

  it('QS with no sessions gets empty list', async () => {
    // COUNT returns 0
    setupListMocks(0, []);

    const res = await request(app)
      .get('/api/audit-processes')
      .set('Authorization', `Bearer ${qalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('SQL WHERE includes mychecker filter when role=QA', async () => {
    setupListMocks(1, [CHPI_ROWS[0]]);

    await request(app)
      .get('/api/audit-processes')
      .set('Authorization', `Bearer ${qaToken}`);

    // Find the data query (SELECT with gv_name)
    const dataCall = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('gv_name')
    );
    expect(dataCall).toBeDefined();
    expect(dataCall![0]).toContain('mychecker = ?');
  });

  it('SQL WHERE does NOT include mychecker filter when role=AD', async () => {
    setupListMocks(2, CHPI_ROWS);

    await request(app)
      .get('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`);

    const dataCall = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('gv_name')
    );
    expect(dataCall).toBeDefined();
    expect(dataCall![0]).not.toContain('mychecker = ?');
  });
});
