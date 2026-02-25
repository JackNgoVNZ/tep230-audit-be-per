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
});

describe('POST /api/audit-steps/:code/start', () => {
  it('should start a step and cascade CHLI → CHSI → CHPI to Auditing', async () => {
    // 1. Fetch CHSI
    mockQuery.mockResolvedValueOnce([{ code: 'CHSI_01', mychpi: 'CHPI_001', description: null }]);
    // 2. CASCADE: UPDATE CHLI status to Auditing
    mockQuery.mockResolvedValueOnce(undefined);
    // 3. CASCADE: UPDATE CHSI status + description with [STARTED]
    mockQuery.mockResolvedValueOnce(undefined);
    // 4. CASCADE: UPDATE CHPI status to Auditing
    mockQuery.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/audit-steps/CHSI_01/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      step_code: 'CHSI_01',
      step_status: 'AUDITING',
    });

    // Verify CHLI status updated to Auditing
    const chliUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE bp_chli_checklistitem') && (call[0] as string).includes('Auditing'),
    );
    expect(chliUpdate).toBeDefined();

    // Verify CHSI description updated with [STARTED]
    const chsiUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE bp_chsi_checkstepitem') && (call[0] as string).includes('[STARTED]'),
    );
    expect(chsiUpdate).toBeDefined();

    // Verify CHPI status updated to Auditing
    const chpiUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE bp_chpi_checkprocessitem') && (call[0] as string).includes('Auditing'),
    );
    expect(chpiUpdate).toBeDefined();
  });

  it('should return 400 when starting an already-started step', async () => {
    // CHSI already has [STARTED] in description
    mockQuery.mockResolvedValueOnce([{ code: 'CHSI_01', mychpi: 'CHPI_001', description: '[STARTED]' }]);

    const res = await request(app)
      .post('/api/audit-steps/CHSI_01/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already/i);
  });
});

describe('POST /api/audit-steps/:code/complete', () => {
  it('should complete a step when all CHLI are scored', async () => {
    // 1. Fetch CHSI (already started)
    mockQuery.mockResolvedValueOnce([{ code: 'CHSI_01', mychpi: 'CHPI_001', description: '[STARTED]' }]);
    // 2. Check unscored CHLI count
    mockQuery.mockResolvedValueOnce([{ unscored: 0 }]);
    // 3. UPDATE CHSI status + description with [COMPLETED]
    mockQuery.mockResolvedValueOnce(undefined);
    // 4. UPDATE CHLI status to Audited
    mockQuery.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/audit-steps/CHSI_01/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      step_code: 'CHSI_01',
      step_status: 'AUDITED',
    });

    // Verify description updated with [COMPLETED]
    const updateCall = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE') && (call[0] as string).includes('[COMPLETED]'),
    );
    expect(updateCall).toBeDefined();

    // Verify CHLI status updated to Audited
    const chliUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE bp_chli_checklistitem') && (call[0] as string).includes('Audited'),
    );
    expect(chliUpdate).toBeDefined();
  });

  it('should return 400 when not all CHLI items are scored', async () => {
    // CHSI exists and started
    mockQuery.mockResolvedValueOnce([{ code: 'CHSI_01', mychpi: 'CHPI_001', description: '[STARTED]' }]);
    // 2 unscored items
    mockQuery.mockResolvedValueOnce([{ unscored: 2 }]);

    const res = await request(app)
      .post('/api/audit-steps/CHSI_01/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not all items scored/i);
  });
});
