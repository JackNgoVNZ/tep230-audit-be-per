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

describe('registerJobs — auto-assign', () => {
  it('should register AutoAssignAuditor with cron expression 0 7 * * *', () => {
    const { registerJobs } = require('../jobs/index');
    registerJobs();

    expect(cron.schedule).toHaveBeenCalledWith('0 7 * * *', expect.any(Function));
  });
});

// ---------- Test 2-3: autoAssignAuditor ----------

describe('autoAssignAuditor', () => {
  let autoAssignAuditor: () => Promise<{ assigned: number; skipped: number }>;

  beforeAll(() => {
    autoAssignAuditor = require('../jobs/auto-assign-auditor.job').autoAssignAuditor;
  });

  /**
   * Mock sequence for 2 unassigned CHPIs being assigned via randomAssign (batch flow):
   * 1. MySQL: SELECT pending chpi_codes (WHERE mychecker IS NULL AND status = 'Open')
   * 2. MySQL: auditor list with workload
   * 3. MySQL: batch CHPI lookup (both CHPIs)
   * Per CHPI (x2):
   *   4. MySQL: UPDATE CHPI (mychecker + status='Assigned')
   *   5. MySQL: UPDATE CHSI (mychri + status='Assigned')
   *   6. MySQL: UPDATE CHLI (status='Assigned')
   */
  it('should find unassigned CHPIs and assign via round-robin', async () => {
    // 1. MySQL: pending CHPIs (no mychecker, no status)
    mockQuery.mockResolvedValueOnce([
      { chpi_code: 'CHPI-001' },
      { chpi_code: 'CHPI-002' },
    ]);

    // 2. MySQL: auditor list with workload
    mockQuery.mockResolvedValueOnce([
      { usi_code: 'USI-QA01', auditor_name: 'QA Nguyen', workload: 1 },
      { usi_code: 'USI-QA02', auditor_name: 'QA Tran', workload: 2 },
    ]);

    // 3. Batch CHPI lookup
    mockQuery.mockResolvedValueOnce([
      { code: 'CHPI-001', mychecker: null, status: 'Open' },
      { code: 'CHPI-002', mychecker: null, status: 'Open' },
    ]);

    // CHPI-001: UPDATE CHPI + UPDATE CHSI + UPDATE CHLI
    mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHPI
    mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHSI
    mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHLI

    // CHPI-002: UPDATE CHPI + UPDATE CHSI + UPDATE CHLI
    mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHPI
    mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHSI
    mockQuery.mockResolvedValueOnce(undefined); // UPDATE CHLI

    const result = await autoAssignAuditor();

    expect(result.assigned).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('should handle empty pending list gracefully', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // No pending CHPIs
    mockQuery.mockResolvedValueOnce([]);

    const result = await autoAssignAuditor();

    expect(result.assigned).toBe(0);
    expect(result.skipped).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('auto_assigned: 0'));

    logSpy.mockRestore();
  });
});
