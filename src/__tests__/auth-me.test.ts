import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: false, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: false, query: jest.fn() },
}));

import app from '../app';

describe('GET /api/auth/me', () => {
  let validToken: string;

  beforeAll(async () => {
    // Login to get a real token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'audit@2024' });
    validToken = res.body.access_token;
  });

  it('should return 200 with user info for valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('usi_code');
    expect(res.body).toHaveProperty('fullname');
    expect(res.body).toHaveProperty('myust');
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
  });

  it('should return 401 with expired token', async () => {
    const expiredToken = jwt.sign(
      { usi_code: 'AUDIT_ADMIN', fullname: 'Admin', myust: 'AD' },
      process.env.JWT_SECRET || 'default-jwt-secret',
      { expiresIn: 0 }
    );
    // Small delay to ensure token is expired
    await new Promise((r) => setTimeout(r, 10));

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
  });
});
