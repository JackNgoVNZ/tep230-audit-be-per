import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import app from '../app';
import { LocalDataSource } from '../config/local-database';

const mockLocalQuery = LocalDataSource.query as jest.Mock;

function makeToken(role: string, code = 'TEST_USER'): string {
  return jwt.sign(
    { usi_code: code, fullname: 'Test User', myust: role },
    'default-jwt-secret',
    { expiresIn: 86400 }
  );
}

const SAMPLE_THRESHOLDS = [
  { id: 1, code: 'ONB-AUDIT_PASS', audit_type: 'ONB-AUDIT', threshold_type: 'PASS', min_score: 3.0, max_score: null, has_second_audit: 0, has_unreg4: 0, published: 1 },
  { id: 2, code: 'ONB-AUDIT_RETRAIN', audit_type: 'ONB-AUDIT', threshold_type: 'RETRAIN', min_score: 2.29, max_score: 3.0, has_second_audit: 1, has_unreg4: 0, published: 1 },
  { id: 3, code: 'ONB-AUDIT_TERMINATE', audit_type: 'ONB-AUDIT', threshold_type: 'TERMINATE', min_score: null, max_score: 2.29, has_second_audit: 0, has_unreg4: 1, published: 1 },
  { id: 4, code: 'WKL-AUDIT_PASS', audit_type: 'WKL-AUDIT', threshold_type: 'PASS', min_score: 3.0, max_score: null, has_second_audit: 0, has_unreg4: 0, published: 1 },
  { id: 5, code: 'WKL-AUDIT_RETRAIN', audit_type: 'WKL-AUDIT', threshold_type: 'RETRAIN', min_score: 2.5, max_score: 3.0, has_second_audit: 0, has_unreg4: 0, published: 1 },
  { id: 6, code: 'WKL-AUDIT_TERMINATE', audit_type: 'WKL-AUDIT', threshold_type: 'TERMINATE', min_score: null, max_score: 2.5, has_second_audit: 0, has_unreg4: 1, published: 1 },
  { id: 7, code: 'HOT-AUDIT_PASS', audit_type: 'HOT-AUDIT', threshold_type: 'PASS', min_score: 3.0, max_score: null, has_second_audit: 0, has_unreg4: 0, published: 1 },
  { id: 8, code: 'HOT-AUDIT_RETRAIN', audit_type: 'HOT-AUDIT', threshold_type: 'RETRAIN', min_score: 2.5, max_score: 3.0, has_second_audit: 0, has_unreg4: 0, published: 1 },
  { id: 9, code: 'MTL-AUDIT_PASS', audit_type: 'MTL-AUDIT', threshold_type: 'PASS', min_score: 3.0, max_score: null, has_second_audit: 0, has_unreg4: 0, published: 1 },
  { id: 10, code: 'MTL-AUDIT_RETRAIN', audit_type: 'MTL-AUDIT', threshold_type: 'RETRAIN', min_score: 2.29, max_score: 3.0, has_second_audit: 1, has_unreg4: 0, published: 1 },
  { id: 11, code: 'MTL-AUDIT_TERMINATE', audit_type: 'MTL-AUDIT', threshold_type: 'TERMINATE', min_score: null, max_score: 2.29, has_second_audit: 0, has_unreg4: 0, published: 1 },
];

let adminToken: string;
let auditorToken: string;

beforeAll(() => {
  adminToken = makeToken('AD');
  auditorToken = makeToken('QA');
});

beforeEach(() => {
  mockLocalQuery.mockReset();
});

describe('GET /api/thresholds — list all', () => {
  it('should return all 11 threshold configs', async () => {
    mockLocalQuery.mockResolvedValueOnce(SAMPLE_THRESHOLDS);

    const res = await request(app)
      .get('/api/thresholds')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(11);
  });
});

describe('GET /api/thresholds?auditType=ONB-AUDIT — filter', () => {
  it('should return 3 ONBOARDAUDIT thresholds', async () => {
    const onboardRows = SAMPLE_THRESHOLDS.filter(t => t.audit_type === 'ONB-AUDIT');
    mockLocalQuery.mockResolvedValueOnce(onboardRows);

    const res = await request(app)
      .get('/api/thresholds?auditType=ONB-AUDIT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    // Verify SQL had WHERE clause
    const sqlCall = mockLocalQuery.mock.calls[0];
    expect(sqlCall[0]).toContain('WHERE audit_type = ?');
    expect(sqlCall[1]).toContain('ONB-AUDIT');
  });
});

describe('PUT /api/thresholds/:id — update', () => {
  it('should update threshold and return 200', async () => {
    // 1st call: check existence
    mockLocalQuery.mockResolvedValueOnce([SAMPLE_THRESHOLDS[0]]);
    // 2nd call: UPDATE
    mockLocalQuery.mockResolvedValueOnce(undefined);
    // 3rd call: fetch updated record
    mockLocalQuery.mockResolvedValueOnce([{ ...SAMPLE_THRESHOLDS[0], min_score: 3.5 }]);

    const res = await request(app)
      .put('/api/thresholds/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ min_score: 3.5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.min_score).toBe(3.5);
  });

  it('should return 400 for negative min_score', async () => {
    const res = await request(app)
      .put('/api/thresholds/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ min_score: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 403 for non-AD user', async () => {
    const res = await request(app)
      .put('/api/thresholds/1')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ min_score: 3.5 });

    expect(res.status).toBe(403);
  });
});

describe('Threshold endpoints — auth', () => {
  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/thresholds');
    expect(res.status).toBe(401);
  });
});
