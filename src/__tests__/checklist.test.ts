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

describe('GET /api/checklists?chsiCode=XXX', () => {
  it('should return groups with group_name and items array', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        code: 'CHLI_001', name: 'Greeting', mychsi: 'CHSI_01',
        myparentchlt: 'CHLT_PARENT_01', scoretype1: 'SCALE', score1: null,
        do: 'Greet warmly', donot: 'Ignore student', parent_name: 'Communication',
      },
      {
        code: 'CHLI_002', name: 'Tone of voice', mychsi: 'CHSI_01',
        myparentchlt: 'CHLT_PARENT_01', scoretype1: 'SCALE', score1: null,
        do: 'Speak clearly', donot: 'Mumble', parent_name: 'Communication',
      },
      {
        code: 'CHLI_003', name: 'Slide quality', mychsi: 'CHSI_01',
        myparentchlt: 'CHLT_PARENT_02', scoretype1: 'BINARY', score1: null,
        do: 'Use visuals', donot: 'Text only', parent_name: 'Content',
      },
    ]);

    const res = await request(app)
      .get('/api/checklists?chsiCode=CHSI_01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.groups).toHaveLength(2);
    expect(res.body.data.groups[0]).toMatchObject({
      group_name: 'Communication',
      items: expect.arrayContaining([
        expect.objectContaining({ chli_code: 'CHLI_001', criteria_name: 'Greeting', scoretype1: 'SCALE', score1: null }),
      ]),
    });
    expect(res.body.data.groups[0].items).toHaveLength(2);
    expect(res.body.data.groups[1]).toMatchObject({
      group_name: 'Content',
    });
    expect(res.body.data.groups[1].items).toHaveLength(1);
    // Verify do/donot are included
    expect(res.body.data.groups[0].items[0]).toHaveProperty('do', 'Greet warmly');
    expect(res.body.data.groups[0].items[0]).toHaveProperty('donot', 'Ignore student');
  });
});

describe('PUT /api/checklists/batch', () => {
  it('should return 200 and update scores + cascade CHSI/CHPI status', async () => {
    // 1. Batch verify all items exist
    mockQuery.mockResolvedValueOnce([
      { code: 'CHLI_001' },
      { code: 'CHLI_002' },
    ]);
    // 2. Batch UPDATE CHLI via CASE expression
    mockQuery.mockResolvedValueOnce(undefined);
    // 3. SELECT DISTINCT mychsi (cascade: find parent CHSI)
    mockQuery.mockResolvedValueOnce([{ mychsi: 'CHSI_01' }]);
    // 4. UPDATE CHSI status to Auditing
    mockQuery.mockResolvedValueOnce(undefined);
    // 5. SELECT DISTINCT mychpi (cascade: find parent CHPI)
    mockQuery.mockResolvedValueOnce([{ mychpi: 'CHPI_001' }]);
    // 6. UPDATE CHPI status to Auditing
    mockQuery.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .put('/api/checklists/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { chli_code: 'CHLI_001', score1: 4 },
          { chli_code: 'CHLI_002', score1: 3 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated).toBe(2);

    // Verify CHLI UPDATE SQL was called (batch CASE update)
    const chliUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE') && (call[0] as string).includes('bp_chli_checklistitem'),
    );
    expect(chliUpdate).toBeDefined();

    // Verify CHSI cascade UPDATE was called
    const chsiUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE bp_chsi_checkstepitem') && (call[0] as string).includes('Auditing'),
    );
    expect(chsiUpdate).toBeDefined();

    // Verify CHPI cascade UPDATE was called
    const chpiUpdate = mockQuery.mock.calls.find(
      (call: any[]) => (call[0] as string).includes('UPDATE bp_chpi_checkprocessitem') && (call[0] as string).includes('Auditing'),
    );
    expect(chpiUpdate).toBeDefined();
  });

  it('should return 400 for score out of range (score1 > 5)', async () => {
    const res = await request(app)
      .put('/api/checklists/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { chli_code: 'CHLI_001', score1: 6 },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('should return 400 for empty items array', async () => {
    const res = await request(app)
      .put('/api/checklists/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [] });

    expect(res.status).toBe(400);
  });
});
