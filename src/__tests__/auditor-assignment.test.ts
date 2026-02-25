import request from 'supertest';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import app from '../app';
import { AppDataSource } from '../config/database';

const mockQuery = AppDataSource.query as jest.Mock;

async function getToken(role: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: role === 'QA' ? 'auditor' : 'admin', password: 'audit@2024' });
  return res.body.access_token;
}

let adminToken: string;
let qaToken: string;

beforeAll(async () => {
  adminToken = await getToken('AD');
  qaToken = await getToken('QA');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/auditors — list auditors with workload', () => {
  it('should return list of auditors with usi_code, auditor_name, workload', async () => {
    // USI+USID query returns auditors
    mockQuery.mockResolvedValueOnce([
      { usi_code: 'USI-01', auditor_name: 'QA Nguyen', workload: 3 },
      { usi_code: 'USI-02', auditor_name: 'QA Tran', workload: 1 },
    ]);
    // Count query
    mockQuery.mockResolvedValueOnce([{ total: 2 }]);

    const res = await request(app)
      .get('/api/auditors')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('usi_code', 'USI-01');
    expect(res.body.data[0]).toHaveProperty('auditor_name', 'QA Nguyen');
    expect(res.body.data[0]).toHaveProperty('workload', 3);
  });
});

describe('POST /api/auditors/assign — manual assign', () => {
  function setupAssignMocks() {
    // 1. Verify CHPI exists (SELECT code, mychecker, status)
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_ONBOARD_001', mychecker: null, status: 'Open' }]);
    // 2. Verify auditor USI exists (USI with QA/TO duty)
    mockQuery.mockResolvedValueOnce([{ code: 'USI-01', fullname: 'QA Nguyen' }]);
    // 3. UPDATE CHPI.mychecker + status
    mockQuery.mockResolvedValueOnce(undefined);
    // 4. UPDATE CHSI.mychri + status
    mockQuery.mockResolvedValueOnce(undefined);
    // 5. UPDATE CHLI status
    mockQuery.mockResolvedValueOnce(undefined);
  }

  it('should return 200 and update CHPI.mychecker, CHSI.mychri, CHLI status to Assigned', async () => {
    setupAssignMocks();

    const res = await request(app)
      .post('/api/auditors/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_code: 'CHPI_ONBOARD_001', auditor_usi_code: 'USI-01' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      chpi_code: 'CHPI_ONBOARD_001',
      auditor_usi_code: 'USI-01',
      auditor_name: 'QA Nguyen',
      status: 'Assigned',
    });

    // Verify UPDATE CHPI.mychecker
    const chpiUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE') && (call[0] as string).includes('bp_chpi_checkprocessitem'),
    );
    expect(chpiUpdate).toBeDefined();
    expect(chpiUpdate![1]).toContain('USI-01');

    // Verify UPDATE CHSI.mychri
    const chsiUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE') && (call[0] as string).includes('bp_chsi_checkstepitem'),
    );
    expect(chsiUpdate).toBeDefined();
  });

  it('should return 400 when audit session is already Audited', async () => {
    // CHPI exists with Audited status
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_ONBOARD_001', mychecker: 'USI-99', status: 'Audited' }]);

    const res = await request(app)
      .post('/api/auditors/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_code: 'CHPI_ONBOARD_001', auditor_usi_code: 'USI-01' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/audited/i);
  });

  it('should return 404 for invalid auditor_usi_code', async () => {
    // CHPI exists
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_ONBOARD_001', mychecker: null, status: 'Open' }]);
    // Auditor USI not found
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/auditors/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_code: 'CHPI_ONBOARD_001', auditor_usi_code: 'USI-INVALID' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auditors/assign-onboard — create CHPI with CLAG lookup', () => {
  function setupOnboardMocks(options: { existingChpi?: boolean; clagSource?: 'direct' | 'fallback' | 'none' } = {}) {
    const { existingChpi = false, clagSource = 'direct' } = options;

    // 1. assignOnboard: Check if CHPI already exists for USI + ONBOARDAUDIT
    if (existingChpi) {
      mockQuery.mockResolvedValueOnce([{ code: 'CHPI_EXISTING' }]);
      // UPDATE CHPI
      mockQuery.mockResolvedValueOnce(undefined);
      // UPDATE CHSI
      mockQuery.mockResolvedValueOnce(undefined);
      // UPDATE CHLI
      mockQuery.mockResolvedValueOnce(undefined);
      return;
    }
    mockQuery.mockResolvedValueOnce([]); // No existing CHPI

    // 2. createOnboardAudit: bp_cuie_details → mypt, mygg, mylcp, mylct, myulc, myparentush, cap_startperiod
    mockQuery.mockResolvedValueOnce([{
      mypt: 'KMA_TT_8', mygg: 'G3', mylcp: 'GES4-75MI-FD1-GE4-75MI',
      mylct: 'GES4', myulc: 'ULC-001',
      myparentush: 'USH-001', cap_startperiod: '2026-02-07 12:15:00',
    }]);

    // 3. createOnboardAudit: CHPT lookup
    mockQuery.mockResolvedValueOnce([{
      code: 'CHPT_001', name: 'Onboard Template', mylcet: 'LCET_001',
    }]);

    // 4. resolveCtiData: CLAG from bp_usi_vcr_meeting + SSTE + VCR
    if (clagSource === 'direct') {
      mockQuery.mockResolvedValueOnce([{ clag_code: 'CLAG-001' }]); // CLAG found
      mockQuery.mockResolvedValueOnce([{ myvalueset: 'https://slide.example.com/1' }]); // SSTE slide
      mockQuery.mockResolvedValueOnce([{ view_url: 'https://video.example.com/1' }]);   // VCR video
    } else if (clagSource === 'fallback') {
      mockQuery.mockResolvedValueOnce([{ clag_code: 'CLAG-FALLBACK' }]); // CLAG found (different value)
      mockQuery.mockResolvedValueOnce([{ myvalueset: 'https://slide.example.com/1' }]); // SSTE slide
      mockQuery.mockResolvedValueOnce([{ view_url: 'https://video.example.com/1' }]);   // VCR video
    } else {
      mockQuery.mockResolvedValueOnce([]);  // CLAG not found
      mockQuery.mockResolvedValueOnce([]);  // SSTE slide (no results)
      mockQuery.mockResolvedValueOnce([]);  // VCR video (no results)
    }

    // 5. INSERT CHPI
    mockQuery.mockResolvedValueOnce(undefined);

    // 6. createStepsAndChecklists: CHST templates
    mockQuery.mockResolvedValueOnce([{ code: 'CHST_001', name: 'Page 1', checksample: 10 }]);
    // 7. INSERT CHSI
    mockQuery.mockResolvedValueOnce(undefined);
    // 8. CHLT templates
    mockQuery.mockResolvedValueOnce([{
      code: 'CHLT_001', subcode: 'S1', name: 'Criterion 1',
      myparentchlt: null, scoretype: 'SCORE', score1: 10,
      scoretype2: null, score2: null,
      do: 'Do this', donot: 'Dont do that',
      correctexample: 'Good', incorrectexample: 'Bad',
    }]);
    // 9. INSERT CHLI
    mockQuery.mockResolvedValueOnce(undefined);
  }

  it('should create CHPI with mycti1/mycti2 when CLAG found directly from bp_cuie_details', async () => {
    setupOnboardMocks({ clagSource: 'direct' });

    const res = await request(app)
      .post('/api/auditors/assign-onboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ usi_code: 'hoabt2', auditor_usi_code: 'USI-01', cuie_code: 'CUIE_TEST_001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('chpi_code');
    expect(res.body.data.status).toBe('Assigned');

    // Verify INSERT CHPI includes slide URL, video JSON, and CLAG
    const insertCall = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('INSERT INTO bp_chpi_checkprocessitem'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toContain('https://slide.example.com/1');
    expect(insertCall![1]).toContain(JSON.stringify(['https://video.example.com/1']));
    expect(insertCall![1]).toContain('CLAG-001');
  });

  it('should create CHPI with mycti1/mycti2 when CLAG found via bp_usi_vcr_meeting', async () => {
    setupOnboardMocks({ clagSource: 'fallback' });

    const res = await request(app)
      .post('/api/auditors/assign-onboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ usi_code: 'hoabt2', auditor_usi_code: 'USI-01', cuie_code: 'CUIE_TEST_002' });

    expect(res.status).toBe(200);

    // Verify CLAG query was called (bp_usi_vcr_meeting)
    const clagCall = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('bp_usi_vcr_meeting'),
    );
    expect(clagCall).toBeDefined();

    // Verify INSERT CHPI includes slide URL and resolved CLAG
    const insertCall = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('INSERT INTO bp_chpi_checkprocessitem'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toContain('https://slide.example.com/1');
    expect(insertCall![1]).toContain('CLAG-FALLBACK');
  });

  it('should create CHPI with null mycti1/mycti2 when CLAG not found', async () => {
    setupOnboardMocks({ clagSource: 'none' });

    const res = await request(app)
      .post('/api/auditors/assign-onboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ usi_code: 'sangnt', auditor_usi_code: 'USI-01', cuie_code: 'CUIE_TEST_003' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify INSERT CHPI has null for mycti1/mycti2
    const insertCall = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('INSERT INTO bp_chpi_checkprocessitem'),
    );
    expect(insertCall).toBeDefined();
    // mycti1 and mycti2 should be null
    const params = insertCall![1];
    const mycti1Idx = 7; // position in VALUES
    const mycti2Idx = 8;
    expect(params[mycti1Idx]).toBeNull();
    expect(params[mycti2Idx]).toBeNull();
  });

  it('should update existing CHPI when one already exists for USI + ONBOARDAUDIT', async () => {
    setupOnboardMocks({ existingChpi: true });

    const res = await request(app)
      .post('/api/auditors/assign-onboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ usi_code: 'hoabt2', auditor_usi_code: 'USI-01', cuie_code: 'CUIE_TEST_004' });

    expect(res.status).toBe(200);
    expect(res.body.data.chpi_code).toBe('CHPI_EXISTING');
    expect(res.body.data.status).toBe('Assigned');
  });
});
