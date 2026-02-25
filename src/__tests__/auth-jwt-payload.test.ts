import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: false, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: false, query: jest.fn() },
}));

import app from '../app';

describe('JWT payload structure', () => {
  it('should contain usi_code, myust, fullname in the token payload', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'audit@2024' });

    expect(res.status).toBe(200);
    const token = res.body.access_token;
    const secret = process.env.JWT_SECRET || 'default-jwt-secret';
    const decoded = jwt.verify(token, secret) as Record<string, any>;

    expect(decoded).toHaveProperty('usi_code');
    expect(decoded).toHaveProperty('myust');
    expect(decoded).toHaveProperty('fullname');
    expect(decoded.usi_code).toBe('AUDIT_ADMIN');
    expect(decoded.myust).toBe('AD');
    expect(decoded.fullname).toBe('Audit Administrator');
  });
});
