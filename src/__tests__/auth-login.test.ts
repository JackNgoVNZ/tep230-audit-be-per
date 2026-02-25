import request from 'supertest';

// Mock both data sources so app.ts imports don't fail
jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: false, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: false, query: jest.fn() },
}));

import app from '../app';

describe('POST /api/auth/login', () => {
  it('should return 200 with access_token and user for valid admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'audit@2024' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('usi_code');
    expect(res.body.user).toHaveProperty('fullname');
    expect(res.body.user).toHaveProperty('myust');
  });

  it('should return AD role for admin dev account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'audit@2024' });

    expect(res.status).toBe(200);
    expect(res.body.user.myust).toBe('AD');
  });

  it('should return 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wrong', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message', 'Invalid credentials');
  });

  it('should return 401 for removed dev accounts (manager, qaleader, auditor)', async () => {
    for (const username of ['manager', 'qaleader', 'auditor']) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'audit@2024' });

      expect(res.status).toBe(401);
    }
  });

  it('should return 400 validation error for empty body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('should return 400 validation error for missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
  });
});
