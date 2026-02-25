import request from 'supertest';

jest.mock('../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    query: jest.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

jest.mock('../config/local-database', () => ({
  LocalDataSource: {
    isInitialized: true,
    query: jest.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

import app from '../app';

describe('GET /api/health — db field', () => {
  it('should return db: connected when AppDataSource is initialized', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('db', 'connected');
    expect(response.body).not.toHaveProperty('localDb');
  });

  it('should return db: disconnected when AppDataSource is not initialized', async () => {
    const { AppDataSource } = require('../config/database');
    AppDataSource.isInitialized = false;

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('db', 'disconnected');
    expect(response.body).not.toHaveProperty('localDb');

    // Restore
    AppDataSource.isInitialized = true;
  });
});
