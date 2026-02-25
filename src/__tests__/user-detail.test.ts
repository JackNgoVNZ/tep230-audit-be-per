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

const SAMPLE_USER = {
  id: 1, code: 'USI-001', username: 'teacher1', fullname: 'Nguyen Van A',
  displayname: 'Teacher A', email: 'a@test.com', clevai_email: 'a@clevai.com',
  phone: '0901234567', avatar: null, myust: 'TE', myparent: null,
  active: 1, created_at: '2024-01-01', user_type_name: 'Teacher',
};

const SAMPLE_USID_LIST = [
  { id: 1, code: 'USID-001', myusi: 'USI-001', created_at: '2024-01-01' },
  { id: 2, code: 'USID-002', myusi: 'USI-001', created_at: '2024-02-01' },
];

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/users/:code — user detail', () => {
  it('should return user detail with usid_list and pod_count', async () => {
    mockQuery
      .mockResolvedValueOnce([SAMPLE_USER])       // user detail query
      .mockResolvedValueOnce(SAMPLE_USID_LIST)     // usid list query
      .mockResolvedValueOnce([{ count: 5 }]);      // pod count query

    const res = await request(app)
      .get('/api/users/USI-001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      code: 'USI-001',
      fullname: 'Nguyen Van A',
      email: 'a@test.com',
      phone: '0901234567',
      myust: 'TE',
      user_type_name: 'Teacher',
    });
    expect(res.body.data.usid_list).toHaveLength(2);
    expect(res.body.data.pod_count).toBe(5);
  });

  it('should return 404 for nonexistent user', async () => {
    mockQuery.mockResolvedValueOnce([]);  // empty result

    const res = await request(app)
      .get('/api/users/NONEXISTENT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('User not found');
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/users/USI-001');

    expect(res.status).toBe(401);
  });

  it('should query correct tables (USI+UST join, USID, POD)', async () => {
    mockQuery
      .mockResolvedValueOnce([SAMPLE_USER])
      .mockResolvedValueOnce(SAMPLE_USID_LIST)
      .mockResolvedValueOnce([{ count: 3 }]);

    await request(app)
      .get('/api/users/USI-001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(mockQuery).toHaveBeenCalledTimes(3);

    // First call: user detail with UST join
    const userQuery = mockQuery.mock.calls[0][0];
    expect(userQuery).toContain('bp_usi_useritem');
    expect(userQuery).toContain('bp_ust_usertype');
    expect(mockQuery.mock.calls[0][1]).toContain('USI-001');

    // Second call: USID list
    const usidQuery = mockQuery.mock.calls[1][0];
    expect(usidQuery).toContain('bp_usid_usiduty');
    expect(mockQuery.mock.calls[1][1]).toContain('USI-001');

    // Third call: POD count
    const podQuery = mockQuery.mock.calls[2][0];
    expect(podQuery).toContain('bp_pod_productofdeal');
    expect(mockQuery.mock.calls[2][1]).toContain('USI-001');
  });
});
