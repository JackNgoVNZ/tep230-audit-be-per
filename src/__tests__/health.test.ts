import request from 'supertest';
import app from '../app';

jest.mock('../config/database', () => ({
  AppDataSource: {
    isInitialized: false,
    query: jest.fn(),
  },
}));

describe('GET /api/health', () => {
  it('should return status 200 with ok, db status, and timestamp', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('db');
    expect(response.body).toHaveProperty('timestamp');
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });
});
