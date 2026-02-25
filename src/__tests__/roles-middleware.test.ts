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

const mockLocalQuery = (LocalDataSource as any).query as jest.Mock;

function makeToken(role: string, code = 'TEST_USER'): string {
  return jwt.sign(
    { usi_code: code, fullname: 'Test User', myust: role },
    'default-jwt-secret',
    { expiresIn: 86400 }
  );
}

let tokens: Record<string, string>;

beforeAll(() => {
  tokens = {
    AD: makeToken('AD'),
    TO: makeToken('TO'),
    QS: makeToken('QS'),
    QA: makeToken('QA'),
  };
});

beforeEach(() => {
  mockLocalQuery.mockReset();
});

describe('roles middleware — PUT /api/thresholds/1 (roles AD only)', () => {
  it('should allow AD token', async () => {
    // Mock: existence check, UPDATE, re-fetch
    mockLocalQuery.mockResolvedValueOnce([{ id: 1, code: 'ONB-AUDIT_PASS', min_score: 3.0 }]);
    mockLocalQuery.mockResolvedValueOnce(undefined);
    mockLocalQuery.mockResolvedValueOnce([{ id: 1, code: 'ONB-AUDIT_PASS', min_score: 3.5 }]);

    const res = await request(app)
      .put('/api/thresholds/1')
      .set('Authorization', `Bearer ${tokens.AD}`)
      .send({ min_score: 3.5 });

    expect(res.status).toBe(200);
  });

  it('should reject QA token with 403', async () => {
    const res = await request(app)
      .put('/api/thresholds/1')
      .set('Authorization', `Bearer ${tokens.QA}`)
      .send({ min_score: 3.5 });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Forbidden' });
  });

  it('should reject TO token with 403', async () => {
    const res = await request(app)
      .put('/api/thresholds/1')
      .set('Authorization', `Bearer ${tokens.TO}`)
      .send({ min_score: 3.5 });

    expect(res.status).toBe(403);
  });
});

describe('roles middleware — GET /api/settings/chpt (roles AD, TO, QS)', () => {
  it('should allow AD token', async () => {
    const { AppDataSource } = require('../config/database');
    const mockQuery = AppDataSource.query as jest.Mock;
    mockQuery.mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]); // hasMyptMygg check
    mockQuery.mockResolvedValueOnce([]); // data
    mockQuery.mockResolvedValueOnce([{ total: 0 }]); // count

    const res = await request(app)
      .get('/api/settings/chpt')
      .set('Authorization', `Bearer ${tokens.AD}`);

    expect(res.status).toBe(200);
    mockQuery.mockReset();
  });

  it('should allow TO token', async () => {
    const { AppDataSource } = require('../config/database');
    const mockQuery = AppDataSource.query as jest.Mock;
    mockQuery.mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]); // hasMyptMygg check
    mockQuery.mockResolvedValueOnce([]);
    mockQuery.mockResolvedValueOnce([{ total: 0 }]);

    const res = await request(app)
      .get('/api/settings/chpt')
      .set('Authorization', `Bearer ${tokens.TO}`);

    expect(res.status).toBe(200);
    mockQuery.mockReset();
  });

  it('should allow QS token', async () => {
    const { AppDataSource } = require('../config/database');
    const mockQuery = AppDataSource.query as jest.Mock;
    mockQuery.mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]); // hasMyptMygg check
    mockQuery.mockResolvedValueOnce([]);
    mockQuery.mockResolvedValueOnce([{ total: 0 }]);

    const res = await request(app)
      .get('/api/settings/chpt')
      .set('Authorization', `Bearer ${tokens.QS}`);

    expect(res.status).toBe(200);
    mockQuery.mockReset();
  });

  it('should reject QA token with 403', async () => {
    const res = await request(app)
      .get('/api/settings/chpt')
      .set('Authorization', `Bearer ${tokens.QA}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Forbidden' });
  });
});

describe('roles middleware — GET /api/checklists (roles AD, TO, QS, QA)', () => {
  it('should allow QA token', async () => {
    const res = await request(app)
      .get('/api/checklists')
      .set('Authorization', `Bearer ${tokens.QA}`);

    // The route exists and QA is allowed — may return 400 for missing params, but NOT 403
    expect(res.status).not.toBe(403);
  });

  it('should reject TE token with 403', async () => {
    const teToken = makeToken('TE');
    const res = await request(app)
      .get('/api/checklists')
      .set('Authorization', `Bearer ${teToken}`);

    expect(res.status).toBe(403);
  });
});

describe('roles middleware — missing auth', () => {
  it('should return 401 when no token provided (auth middleware handles it)', async () => {
    const res = await request(app).get('/api/thresholds');

    expect(res.status).toBe(401);
  });
});
