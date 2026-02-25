jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

import { AppDataSource } from '../config/database';
import cron from 'node-cron';

const mockQuery = AppDataSource.query as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
  jest.clearAllMocks();
});

// ---------- Test 1: Job registration ----------

describe('registerJobs — cleanup-old-data', () => {
  it('should register CleanupOldData with cron expression 0 3 1 * *', () => {
    const { registerJobs } = require('../jobs/index');
    registerJobs();

    expect(cron.schedule).toHaveBeenCalledWith('0 3 1 * *', expect.any(Function));
  });
});

// ---------- Test 2-3: cleanupOldData ----------

describe('cleanupOldData', () => {
  let cleanupOldData: () => Promise<{ found: number }>;

  beforeAll(() => {
    cleanupOldData = require('../jobs/cleanup-old-data.job').cleanupOldData;
  });

  it('should find old CHPI records from MySQL and log them', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // MySQL: old CHPI records (created_at <= DATE_SUB(NOW(), INTERVAL 6 MONTH))
    mockQuery.mockResolvedValueOnce([
      { chpi_code: 'CHPI-OLD-001', audit_type: 'ONB-AUDIT', status: 'Audited', created_at: '2025-06-01 10:00:00' },
      { chpi_code: 'CHPI-OLD-002', audit_type: 'WKL-AUDIT', status: 'Open', created_at: '2025-05-15 14:00:00' },
    ]);

    const result = await cleanupOldData();

    expect(result.found).toBe(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CHPI-OLD-001'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('found: 2'));

    logSpy.mockRestore();
  });

  it('should handle no old records gracefully', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockQuery.mockResolvedValueOnce([]);

    const result = await cleanupOldData();

    expect(result.found).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('found: 0'));

    logSpy.mockRestore();
  });
});
