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

let mgrToken: string;

beforeAll(() => {
  mgrToken = makeToken('TO');
});

beforeEach(() => {
  mockLocalQuery.mockReset();
});

describe('Email template role update', () => {
  it('POST /api/email/templates as TO returns 201', async () => {
    mockLocalQuery.mockResolvedValueOnce([]); // dup check
    mockLocalQuery.mockResolvedValueOnce({ insertId: 10 }); // insert

    const res = await request(app)
      .post('/api/email/templates')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ code: 'TEST', name: 'Test Template', subject: 'Test Subject', bodyHtml: '<p>Hello</p>' });

    expect(res.status).toBe(201);
  });

  it('PUT /api/email/templates/:id as TO returns 200', async () => {
    mockLocalQuery.mockResolvedValueOnce([{ id: 1, code: 'PASS', name: 'Pass', subject: 'Old', body_html: '<p>Old</p>' }]); // exists check
    mockLocalQuery.mockResolvedValueOnce({ affectedRows: 1 }); // update
    mockLocalQuery.mockResolvedValueOnce([{ id: 1, code: 'PASS', name: 'Pass', subject: 'Updated', body_html: '<p>Updated</p>' }]); // re-select

    const res = await request(app)
      .put('/api/email/templates/1')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ subject: 'Updated', bodyHtml: '<p>Updated</p>' });

    expect(res.status).toBe(200);
  });
});
