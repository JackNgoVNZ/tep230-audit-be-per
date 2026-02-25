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

const VALID_INPUT = {
  cuie_code: 'CUIE-JSU-001',
  audit_type: 'ONB-AUDIT',
  trigger_usi_code: 'USI-TE001',
};

const MOCK_CUIE_DETAILS = { mypt: 'PT1', mygg: 'GG1', mylcp: 'LCP1', mylct: 'LCT1', myulc: 'ULC-001' };
const MOCK_CHPT = { code: 'CHPT-001', name: 'Onboard Process', mylcet: 'LCET-JSU' };

const MOCK_CHST_ROWS = [
  { code: 'CHST-01', name: 'Step 1', checksample: 3, mychrt: 'CHRT-01' },
  { code: 'CHST-02', name: 'Step 2', checksample: 2, mychrt: 'CHRT-01' },
];

const MOCK_CHLT_STEP1 = [
  {
    code: 'CHLT-01', subcode: 'A1', name: 'Checklist 1', myparentchlt: null,
    scoretype: 'SCALE', score1: '5', scoretype2: null, score2: null,
    do: 'do this', donot: 'not that', correctexample: 'good', incorrectexample: 'bad',
  },
  {
    code: 'CHLT-02', subcode: 'A2', name: 'Checklist 2', myparentchlt: 'CHLT-01',
    scoretype: 'BINARY', score1: '1', scoretype2: null, score2: null,
    do: null, donot: null, correctexample: null, incorrectexample: null,
  },
];

const MOCK_CHLT_STEP2 = [
  {
    code: 'CHLT-03', subcode: 'B1', name: 'Checklist 3', myparentchlt: null,
    scoretype: 'SCALE', score1: '5', scoretype2: null, score2: null,
    do: null, donot: null, correctexample: null, incorrectexample: null,
  },
];

function setupSuccessMocks() {
  mockQuery
    .mockResolvedValueOnce([MOCK_CUIE_DETAILS]) // 1. bp_cuie_details resolve PT/GG/LCP + ULC
    .mockResolvedValueOnce([MOCK_CHPT])          // 2. CHPT lookup by mypt + mygg + mylcp
    .mockResolvedValueOnce([])                    // 3. Duplicate check
    .mockResolvedValueOnce([{ clag_code: 'CLAG-001' }])                     // 4. resolveCtiData: CLAG from bp_usi_vcr_meeting
    .mockResolvedValueOnce([{ myvalueset: 'https://slide.example.com/1' }]) // 5. resolveCtiData: SSTE slide query
    .mockResolvedValueOnce([{ view_url: 'https://video.example.com/1' }])   // 6. resolveCtiData: VCR video query
    .mockResolvedValueOnce(undefined)             // 7. INSERT CHPI
    .mockResolvedValueOnce(MOCK_CHST_ROWS)        // 7. Fetch CHST
    .mockResolvedValueOnce(undefined)             // 8. INSERT CHSI #1
    .mockResolvedValueOnce(MOCK_CHLT_STEP1)       // 9. Fetch CHLT for step 1
    .mockResolvedValueOnce(undefined)             // 10. INSERT CHLI #1
    .mockResolvedValueOnce(undefined)             // 11. INSERT CHLI #2
    .mockResolvedValueOnce(undefined)             // 12. INSERT CHSI #2
    .mockResolvedValueOnce(MOCK_CHLT_STEP2)       // 13. Fetch CHLT for step 2
    .mockResolvedValueOnce(undefined);            // 14. INSERT CHLI #3
}

let adminToken: string;
let auditorToken: string;

beforeAll(() => {
  adminToken = makeToken('AD');
  auditorToken = makeToken('QA');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('POST /api/audit-processes — create cascade', () => {
  it('should return 201 with chpi_code, chsi_count, chli_count', async () => {
    setupSuccessMocks();

    const res = await request(app)
      .post('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.chpi_code).toMatch(/^ULC-001_ONB-AUDIT_USI-TE001_[a-z0-9]+$/);
    expect(res.body.data.chsi_count).toBe(2);
    expect(res.body.data.chli_count).toBe(3);
  });

  it('should INSERT into bp_chpi_checkprocessitem with correct params', async () => {
    setupSuccessMocks();

    await request(app)
      .post('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_INPUT);

    const insertCall = mockQuery.mock.calls[6]; // 7th call = CHPI INSERT (after cuie_details, CHPT, dup check, CLAG, SSTE, VCR)
    expect(insertCall[0]).toContain('INSERT INTO bp_chpi_checkprocessitem');
    expect(insertCall[1]).toContain('CHPT-001');         // mychpt (from CHPT lookup)
    expect(insertCall[1]).toContain('ONB-AUDIT');           // mychpttype
    expect(insertCall[1]).toContain('CUIE-JSU-001');      // description (cuie_code reference)
    expect(insertCall[1]).toContain('USI-TE001');         // mytrigger
  });

  it('should INSERT 2 CHSI rows into bp_chsi_checkstepitem', async () => {
    setupSuccessMocks();

    await request(app)
      .post('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_INPUT);

    const chsiInserts = mockQuery.mock.calls.filter(
      (call: any[]) => (call[0] as string).includes('INSERT INTO bp_chsi_checkstepitem')
    );
    expect(chsiInserts).toHaveLength(2);
  });

  it('should INSERT 3 CHLI rows into bp_chli_checklistitem', async () => {
    setupSuccessMocks();

    await request(app)
      .post('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_INPUT);

    const chliInserts = mockQuery.mock.calls.filter(
      (call: any[]) => (call[0] as string).includes('INSERT INTO bp_chli_checklistitem')
    );
    expect(chliInserts).toHaveLength(3);
  });

  it('should not use SQLite for status tracking', async () => {
    setupSuccessMocks();

    await request(app)
      .post('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_INPUT);

    // All queries go through MySQL AppDataSource.query only
    // Verify no call contains 'audit_session_status'
    const allSqls = mockQuery.mock.calls.map((c: any[]) => c[0] as string).join(' ');
    expect(allSqls).not.toContain('audit_session_status');
  });

  it('should return 409 when CHPI already exists for same CUIE and audit_type', async () => {
    mockQuery
      .mockResolvedValueOnce([MOCK_CUIE_DETAILS])         // bp_cuie_details resolve
      .mockResolvedValueOnce([MOCK_CHPT])                  // CHPT exists
      .mockResolvedValueOnce([{ code: 'CHPI-EXISTING' }]); // Duplicate found

    const res = await request(app)
      .post('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_INPUT);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when CHPT template not found', async () => {
    mockQuery
      .mockResolvedValueOnce([MOCK_CUIE_DETAILS]) // bp_cuie_details resolve
      .mockResolvedValueOnce([]);                   // CHPT not found

    const res = await request(app)
      .post('/api/audit-processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_INPUT);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 403 for QA role', async () => {
    const res = await request(app)
      .post('/api/audit-processes')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send(VALID_INPUT);

    expect(res.status).toBe(403);
  });
});
