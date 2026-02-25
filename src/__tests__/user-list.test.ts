import request from 'supertest';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: false, query: jest.fn() },
}));

import app from '../app';
import { AppDataSource } from '../config/database';

const mockQuery = AppDataSource.query as jest.Mock;

async function getToken(username: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'audit@2024' });
  return res.body.access_token;
}

const SAMPLE_USERS = [
  { id: 1, code: 'USI001', fullname: 'Nguyen Van A', email: 'a@test.com', myust: 'TE', active: 1 },
  { id: 2, code: 'USI002', fullname: 'Tran Thi B', email: 'b@test.com', myust: 'TE', active: 1 },
  { id: 3, code: 'USI003', fullname: 'Le Van C', email: 'c@test.com', myust: 'TO', active: 0 },
];

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/users — paginated list', () => {
  it('should return paginated list with meta { page, limit, total, totalPages }', async () => {
    mockQuery
      .mockResolvedValueOnce(SAMPLE_USERS.slice(0, 2))   // data query
      .mockResolvedValueOnce([{ total: 50 }]);             // count query

    const res = await request(app)
      .get('/api/users?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 50,
      totalPages: 3,
    });
  });

  it('should filter by myust=TE (only Teachers)', async () => {
    mockQuery
      .mockResolvedValueOnce([SAMPLE_USERS[0], SAMPLE_USERS[1]])
      .mockResolvedValueOnce([{ total: 2 }]);

    const res = await request(app)
      .get('/api/users?myust=TE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Verify the SQL query includes the myust filter
    const dataCall = mockQuery.mock.calls[0];
    expect(dataCall[0]).toContain('myust');
    expect(dataCall[1]).toContain('TE');
  });

  it('should filter by keyword (fullname or email match)', async () => {
    mockQuery
      .mockResolvedValueOnce([SAMPLE_USERS[0]])
      .mockResolvedValueOnce([{ total: 1 }]);

    const res = await request(app)
      .get('/api/users?keyword=nguyen')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const dataCall = mockQuery.mock.calls[0];
    expect(dataCall[0]).toContain('LIKE');
    expect(dataCall[1]).toContain('%nguyen%');
  });

  it('should filter by active=1', async () => {
    mockQuery
      .mockResolvedValueOnce([SAMPLE_USERS[0], SAMPLE_USERS[1]])
      .mockResolvedValueOnce([{ total: 2 }]);

    const res = await request(app)
      .get('/api/users?active=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const dataCall = mockQuery.mock.calls[0];
    expect(dataCall[0]).toContain('active');
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
  });

  it('should default to page=1, limit=20 when not provided', async () => {
    mockQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });
});
