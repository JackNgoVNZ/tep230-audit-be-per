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

describe('registerJobs — send-reminder', () => {
  it('should register SendReminder with cron expression 0 9 * * *', () => {
    const { registerJobs } = require('../jobs/index');
    registerJobs();

    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function));
  });
});

// ---------- Test 2-3: sendReminder ----------

describe('sendReminder', () => {
  let sendReminder: () => Promise<{ reminders_sent: number }>;

  beforeAll(() => {
    sendReminder = require('../jobs/send-reminder.job').sendReminder;
  });

  it('should find overdue Assigned audits from MySQL and log reminders', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // MySQL: overdue Assigned sessions (status='Assigned', created_at <= DATE_SUB)
    mockQuery.mockResolvedValueOnce([
      { chpi_code: 'CHPI-001', mychecker: 'CHRI-01' },
      { chpi_code: 'CHPI-002', mychecker: 'CHRI-02' },
    ]);

    const result = await sendReminder();

    expect(result.reminders_sent).toBe(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CHPI-001'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CHRI-01'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('reminders_sent: 2'));

    logSpy.mockRestore();
  });

  it('should handle no overdue audits gracefully', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // No overdue sessions
    mockQuery.mockResolvedValueOnce([]);

    const result = await sendReminder();

    expect(result.reminders_sent).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('reminders_sent: 0'));

    logSpy.mockRestore();
  });
});
