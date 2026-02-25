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

let token: string;

beforeAll(() => {
  token = makeToken('AD');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('POST /api/users', () => {
  it('creates new USI + USID when username not exists', async () => {
    // Check existing → no match
    mockQuery.mockResolvedValueOnce([]);
    // Insert user
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });
    // Insert usiduty
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newuser', fullname: 'New User', email: 'new@test.com', myust: 'QA' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('code');
    expect(res.body.data).toHaveProperty('username', 'newuser');
    expect(res.body.data).toHaveProperty('isNew', true);
  });

  it('adds USID only when USI already exists', async () => {
    // Check existing → found
    mockQuery.mockResolvedValueOnce([{ code: 'USI-EXIST' }]);
    // Check duplicate duty → no match
    mockQuery.mockResolvedValueOnce([]);
    // Insert usiduty
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'existing', fullname: 'Existing', email: 'e@test.com', myust: 'TO' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('code', 'USI-EXIST');
    expect(res.body.data).toHaveProperty('isNew', false);
  });

  it('rejects when USI already has same duty', async () => {
    // Check existing → found
    mockQuery.mockResolvedValueOnce([{ code: 'USI-EXIST' }]);
    // Check duplicate duty → found
    mockQuery.mockResolvedValueOnce([{ code: 'USID-DUP' }]);

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'existing', fullname: 'Existing', email: 'e@test.com', myust: 'QA' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already has duty');
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'x' }); // missing fullname, myust

    expect(res.status).toBe(400);
  });

  it('rejects myust=AD', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'admin2', fullname: 'Admin 2', email: 'a2@test.com', myust: 'AD' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/users/:code', () => {
  it('updates fields', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'USI-001' }]);
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .put('/api/users/USI-001')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullname: 'Updated Name', email: 'updated@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('updated', true);
  });

  it('returns 404 for non-existent user', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .put('/api/users/USI-NONEXIST')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullname: 'Test' });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/users/:code/unpublish (USID level)', () => {
  it('sets published=0 on USID', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'USID-001' }]);
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .patch('/api/users/USID-001/unpublish')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('usid_code', 'USID-001');
    expect(res.body.data).toHaveProperty('active', 0);
  });
});

describe('PATCH /api/users/:code/publish (USID level)', () => {
  it('sets published=1 on USID', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'USID-003' }]);
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .patch('/api/users/USID-003/publish')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('usid_code', 'USID-003');
    expect(res.body.data).toHaveProperty('active', 1);
  });

  it('returns 404 for non-existent USID', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .patch('/api/users/USID-NONEXIST/publish')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('Role-based access', () => {
  it('only AD/TO can create', async () => {
    // QS should get 403
    const qsToken = makeToken('QS');
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${qsToken}`)
      .send({ username: 'x', fullname: 'X', email: 'x@t.com', myust: 'QA' });

    expect(res.status).toBe(403);
  });

  it('401 without token', async () => {
    const res = await request(app).post('/api/users').send({});
    expect(res.status).toBe(401);
  });
});
