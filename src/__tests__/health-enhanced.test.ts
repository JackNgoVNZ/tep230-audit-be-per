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

describe('GET /api/health (enhanced with db status)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(mockedDataSource, 'isInitialized', {
      value: true,
      writable: true,
    });
  });

  it('should include db: "connected" when database is initialized and query succeeds', async () => {
    (mockedDataSource.query as jest.Mock).mockResolvedValue([{ result: 1 }]);

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('db', 'connected');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('should include db: "disconnected" when database query fails', async () => {
    (mockedDataSource.query as jest.Mock).mockRejectedValue(new Error('Connection lost'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('db', 'disconnected');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('should include db: "disconnected" when DataSource is not initialized', async () => {
    Object.defineProperty(mockedDataSource, 'isInitialized', {
      value: false,
      writable: true,
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('db', 'disconnected');
    expect(response.body).toHaveProperty('timestamp');
  });
});
