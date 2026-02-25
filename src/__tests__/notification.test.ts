import request from 'supertest';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-query', () => ({
  localQuery: jest.fn(),
}));

import app from '../app';
import { AppDataSource } from '../config/database';
import { localQuery } from '../config/local-query';

const mockQuery = AppDataSource.query as jest.Mock;
const mockLocalQuery = localQuery as jest.Mock;

async function getToken(username: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'audit@2024' });
  return res.body.access_token;
}

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
  mockLocalQuery.mockReset();
});

// ---------- GET /api/notifications ----------

describe('GET /api/notifications', () => {
  it('should return combined notifications from sessions and feedback → 200', async () => {
    // Query 1: MySQL — CHPI sessions for user (mytrigger or mychecker)
    mockQuery.mockResolvedValueOnce([
      { chpi_code: 'CHPI_001', audit_type: 'ONB-AUDIT', status: 'Audited', created_at: '2026-01-15 10:00:00' },
      { chpi_code: 'CHPI_002', audit_type: 'WKL-AUDIT', status: 'Auditing', created_at: '2026-01-14 09:00:00' },
    ]);

    // Query 2: localQuery — audit_feedback
    mockLocalQuery.mockResolvedValueOnce([
      { id: 10, code: 'FDBK_001', chpi_code: 'CHPI_001', feedback_type: 'SCORE_DISPUTE', status: 'PENDING', created_at: '2026-01-16 08:00:00' },
    ]);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    // Should be sorted by created_at DESC — feedback first (Jan 16), then sessions (Jan 15, Jan 14)
    expect(res.body.data[0].notification_type).toBe('FEEDBACK');
    expect(res.body.data[1].notification_type).toBe('AUDIT_STATUS');
    // Session notification IDs are now index-based (idx + 1)
    expect(res.body.data[1].id).toBe(1);
    expect(res.body.data[2].id).toBe(2);
  });
});

// ---------- POST /api/notifications/mark-read/:id ----------

describe('POST /api/notifications/mark-read/:id', () => {
  it('should mark notification as read → 200', async () => {
    const res = await request(app)
      .post('/api/notifications/mark-read/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.isRead).toBe(true);
  });
});
