import request from 'supertest';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-query', () => ({
  localQuery: jest.fn(),
}));

import app from '../app';
import { AppDataSource } from '../config/database';
import { localQuery } from '../config/local-query';

const mockQuery = AppDataSource.query as jest.Mock;
const mockLocalQuery = localQuery as jest.Mock;

async function getToken(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'audit@2024' });
  return res.body.access_token;
}

let token: string;

beforeAll(async () => {
  token = await getToken();
});

beforeEach(() => {
  mockQuery.mockReset();
  mockLocalQuery.mockReset();
});

describe('POST /api/scoring/calculate/:chpiCode', () => {
  it('should return total_score using the formula SUM(CHLI.score1) / SUM(CHLT.score1) * 5.0', async () => {
    // 1. Verify process exists
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_001' }]);
    // 2. Score calculation query
    // Example: actual=14, max=20 → 14/20 * 5.0 = 3.5
    mockQuery.mockResolvedValueOnce([{
      total_actual: '14',
      total_max: '20',
      total_items: '4',
      scored_items: '4',
    }]);

    const res = await request(app)
      .post('/api/scoring/calculate/CHPI_001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.finalScore).toBe(3.5);
    expect(res.body.data.maxScore).toBe(5.0);
  });
});

describe('POST /api/scoring/complete/:chpiCode', () => {
  function setupCompleteMocks(totalActual: string, totalMax: string, auditType: string, thresholds: any[]) {
    // 1. calculateScore: verify process exists
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_001' }]);
    // 2. calculateScore: score query
    mockQuery.mockResolvedValueOnce([{
      total_actual: totalActual,
      total_max: totalMax,
      total_items: '4',
      scored_items: '4',
    }]);
    // 3. CASCADE: UPDATE CHLI status to Audited (MySQL)
    mockQuery.mockResolvedValueOnce(undefined);
    // 4. CASCADE: UPDATE CHSI status to Audited (MySQL)
    mockQuery.mockResolvedValueOnce(undefined);
    // 5. CASCADE: COUNT incomplete CHSI (MySQL)
    mockQuery.mockResolvedValueOnce([{ cnt: 0 }]);
    // 6. CASCADE: UPDATE CHPI status to Audited (MySQL)
    mockQuery.mockResolvedValueOnce(undefined);
    // 7. checkThreshold: get CHPI from MySQL (mychpttype, status)
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_001', mychpttype: auditType, status: 'Auditing' }]);
    // 8. checkThreshold → calculateScore: verify process
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_001' }]);
    // 9. checkThreshold → calculateScore: score query
    mockQuery.mockResolvedValueOnce([{
      total_actual: totalActual,
      total_max: totalMax,
      total_items: '4',
      scored_items: '4',
    }]);
    // 10. checkThreshold: get thresholds from SQLite (audit_threshold_config)
    mockLocalQuery.mockResolvedValueOnce(thresholds);
  }

  const ONBOARD_THRESHOLDS = [
    { code: 'ONB-AUDIT_TERMINATE', audit_type: 'ONB-AUDIT', threshold_type: 'TERMINATE', min_score: null, max_score: '2.29', published: 1 },
    { code: 'ONB-AUDIT_RETRAIN', audit_type: 'ONB-AUDIT', threshold_type: 'RETRAIN', min_score: '2.29', max_score: '3.00', published: 1 },
    { code: 'ONB-AUDIT_PASS', audit_type: 'ONB-AUDIT', threshold_type: 'PASS', min_score: '3.00', max_score: null, published: 1 },
  ];

  it('should complete with threshold_result = PASS when score >= 3.0', async () => {
    // 14/20 * 5.0 = 3.5 → PASS
    setupCompleteMocks('14', '20', 'ONB-AUDIT', ONBOARD_THRESHOLDS);

    const res = await request(app)
      .post('/api/scoring/complete/CHPI_001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalScore).toBe(3.5);
    expect(res.body.data.thresholdResult).toBe('PASS');
    expect(res.body.data.status).toBe('Audited');
  });

  it('should complete with threshold_result = RETRAIN when 2.29 <= score < 3.0', async () => {
    // 11.2/20 * 5.0 = 2.8 → RETRAIN
    setupCompleteMocks('11.2', '20', 'ONB-AUDIT', ONBOARD_THRESHOLDS);

    const res = await request(app)
      .post('/api/scoring/complete/CHPI_001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalScore).toBe(2.8);
    expect(res.body.data.thresholdResult).toBe('RETRAIN');
  });

  it('should complete with threshold_result = TERMINATE when score < 2.29', async () => {
    // 8/20 * 5.0 = 2.0 → TERMINATE
    setupCompleteMocks('8', '20', 'ONB-AUDIT', ONBOARD_THRESHOLDS);

    const res = await request(app)
      .post('/api/scoring/complete/CHPI_001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalScore).toBe(2.0);
    expect(res.body.data.thresholdResult).toBe('TERMINATE');
  });

  it('should return 400 when not all steps are completed', async () => {
    // 1. verify process exists
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_001' }]);
    // 2. score query — has unscored items
    mockQuery.mockResolvedValueOnce([{
      total_actual: '0',
      total_max: '20',
      total_items: '4',
      scored_items: '2',
    }]);

    const res = await request(app)
      .post('/api/scoring/complete/CHPI_001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not all/i);
  });

  it('should verify MySQL CHPI updated with Audited status', async () => {
    // 14/20 * 5.0 = 3.5 → PASS
    setupCompleteMocks('14', '20', 'ONB-AUDIT', ONBOARD_THRESHOLDS);

    await request(app)
      .post('/api/scoring/complete/CHPI_001')
      .set('Authorization', `Bearer ${token}`);

    // Find the MySQL UPDATE CHPI call
    const updateCall = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('Audited') && (call[0] as string).includes('UPDATE bp_chpi_checkprocessitem'),
    );
    expect(updateCall).toBeDefined();

    // Find the MySQL UPDATE CHSI call
    const chsiUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('Audited') && (call[0] as string).includes('UPDATE bp_chsi_checkstepitem'),
    );
    expect(chsiUpdate).toBeDefined();

    // Find the MySQL UPDATE CHLI call
    const chliUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('Audited') && (call[0] as string).includes('UPDATE bp_chli_checklistitem'),
    );
    expect(chliUpdate).toBeDefined();
  });
});
