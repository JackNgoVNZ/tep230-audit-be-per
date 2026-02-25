import request from 'supertest';
import app from '../app';
import { AppDataSource } from '../config/database';

jest.mock('../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    query: jest.fn(),
  },
}));

const mockedDataSource = AppDataSource as jest.Mocked<typeof AppDataSource>;

describe('GET /api/health/db', () => {
  it('should return 200 with database connected when query succeeds', async () => {
    (mockedDataSource.query as jest.Mock).mockResolvedValue([{ result: 1 }]);

    const response = await request(app).get('/api/health/db');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('database', 'connected');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('should return 503 with database disconnected when query fails', async () => {
    (mockedDataSource.query as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const response = await request(app).get('/api/health/db');

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('database', 'disconnected');
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('should return 503 when DataSource is not initialized', async () => {
    Object.defineProperty(mockedDataSource, 'isInitialized', {
      value: false,
      writable: true,
    });

    const response = await request(app).get('/api/health/db');

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('database', 'disconnected');

    // Restore for other tests
    Object.defineProperty(mockedDataSource, 'isInitialized', {
      value: true,
      writable: true,
    });
  });
});
