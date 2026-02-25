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

beforeAll(async () => {
  adminToken = await getToken('AD');
});

beforeEach(() => {
  mockQuery.mockReset();
});

const MOCK_AUDITORS = [
  { usi_code: 'USI-01', auditor_name: 'QA Nguyen', workload: 3 },
  { usi_code: 'USI-02', auditor_name: 'QA Tran', workload: 1 },
];

/**
 * Setup mocks for a successful round-robin assignment of 3 CHPIs to 2 auditors.
 * New flow (MySQL only, no SQLite):
 * 1. Fetch auditors with workload (USI+USID)
 * 2. Batch CHPI lookup (code, mychecker, status)
 * Per CHPI (x3):
 *   3. UPDATE CHPI
 *   4. UPDATE CHSI
 *   5. UPDATE CHLI
 *
 * Round-robin: sorted by workload ASC, tie-break code ASC.
 * - CHPI-A -> USI-02 (wl=1->2)
 * - CHPI-B -> USI-02 (wl=2 < USI-01 wl=3 -> wl=3)
 * - CHPI-C -> USI-01 (tie wl=3, code ASC -> USI-01, wl=4)
 */
function setupRoundRobinMocks() {
  // 1. Fetch auditors with workload
  mockQuery.mockResolvedValueOnce(MOCK_AUDITORS);

  // 2. Batch CHPI lookup (code, mychecker, status)
  mockQuery.mockResolvedValueOnce([
    { code: 'CHPI-A', mychecker: null, status: 'Open' },
    { code: 'CHPI-B', mychecker: null, status: 'Open' },
    { code: 'CHPI-C', mychecker: null, status: 'Open' },
  ]);

  // Per CHPI: UPDATE CHPI + UPDATE CHSI + UPDATE CHLI
  // CHPI-A
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHPI
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHSI
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHLI

  // CHPI-B
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHPI
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHSI
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHLI

  // CHPI-C
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHPI
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHSI
  mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHLI
}

describe('POST /api/auditors/random-assign — validation', () => {
  it('should return 400 when chpi_codes is empty array', async () => {
    const res = await request(app)
      .post('/api/auditors/random-assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_codes: [] });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auditors/random-assign — round-robin', () => {
  it('should distribute 3 CHPIs across 2 auditors by lowest workload with tie-break', async () => {
    setupRoundRobinMocks();

    const res = await request(app)
      .post('/api/auditors/random-assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_codes: ['CHPI-A', 'CHPI-B', 'CHPI-C'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assigned).toHaveLength(3);
    expect(res.body.data.skipped).toHaveLength(0);

    // CHPI-A -> USI-02 (lowest wl=1)
    expect(res.body.data.assigned[0]).toMatchObject({
      chpi_code: 'CHPI-A',
      auditor_usi_code: 'USI-02',
    });
    // CHPI-B -> USI-02 (wl=2 < USI-01 wl=3)
    expect(res.body.data.assigned[1]).toMatchObject({
      chpi_code: 'CHPI-B',
      auditor_usi_code: 'USI-02',
    });
    // CHPI-C -> USI-01 (tie wl=3, code ASC)
    expect(res.body.data.assigned[2]).toMatchObject({
      chpi_code: 'CHPI-C',
      auditor_usi_code: 'USI-01',
    });
  });

  it('should skip already-assigned CHPI (mychecker not null)', async () => {
    // Auditors
    mockQuery.mockResolvedValueOnce(MOCK_AUDITORS);
    // Batch CHPI lookup — already assigned
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI-X', mychecker: 'USI-99', status: 'Assigned' }]);

    const res = await request(app)
      .post('/api/auditors/random-assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_codes: ['CHPI-X'] });

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toHaveLength(0);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0]).toMatchObject({
      chpi_code: 'CHPI-X',
      reason: expect.stringMatching(/already/i),
    });
  });

  it('should skip CHPI not found', async () => {
    // Auditors
    mockQuery.mockResolvedValueOnce(MOCK_AUDITORS);
    // Batch CHPI lookup — not found (empty for this code)
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/auditors/random-assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_codes: ['CHPI-MISSING'] });

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toHaveLength(0);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0]).toMatchObject({
      chpi_code: 'CHPI-MISSING',
      reason: expect.stringMatching(/not found/i),
    });
  });

  it('should return 400 when no auditors available', async () => {
    // Auditors query returns empty
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/auditors/random-assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_codes: ['CHPI-A'] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no auditors/i);
  });

  it('should skip CHPI with Audited status', async () => {
    // Auditors
    mockQuery.mockResolvedValueOnce(MOCK_AUDITORS);
    // Batch CHPI lookup — exists, not assigned but Audited
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI-DONE', mychecker: null, status: 'Audited' }]);

    const res = await request(app)
      .post('/api/auditors/random-assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ chpi_codes: ['CHPI-DONE'] });

    expect(res.status).toBe(200);
    expect(res.body.data.assigned).toHaveLength(0);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0]).toMatchObject({
      chpi_code: 'CHPI-DONE',
      reason: expect.stringMatching(/audited/i),
    });
  });
});
