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
let teacherToken: string;

beforeAll(() => {
  adminToken = makeToken('AD');
  teacherToken = makeToken('TE');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/gv-filter/retraining', () => {
  it('returns teachers with Audited CHPI eligible for retraining', async () => {
    // MySQL COUNT query
    mockQuery.mockResolvedValueOnce([{ total: 1 }]);
    // MySQL data query
    mockQuery.mockResolvedValueOnce([
      { chpi_code: 'CHPI_001', usi_code: 'USI-TE001', audit_type: 'ONB-AUDIT', status: 'Audited', gv_name: 'Nguyen Van A', gv_email: 'a@clevai.vn' },
    ]);

    const res = await request(app)
      .get('/api/gv-filter/retraining')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].gv_name).toBe('Nguyen Van A');
    expect(res.body.data[0].status).toBe('Audited');
  });

  it('returns empty when no teachers have completed audits', async () => {
    // MySQL COUNT returns 0
    mockQuery.mockResolvedValueOnce([{ total: 0 }]);

    const res = await request(app)
      .get('/api/gv-filter/retraining')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('requires auth (401 without token)', async () => {
    const res = await request(app).get('/api/gv-filter/retraining');

    expect(res.status).toBe(401);
  });

  it('requires role AD/TO/QS/QA (403 for TE)', async () => {
    const res = await request(app)
      .get('/api/gv-filter/retraining')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(403);
  });
});
