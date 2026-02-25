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

describe('registerJobs — hotcase', () => {
  it('should register SyncHotcaseGV with cron expression 0 * * * *', () => {
    const { registerJobs } = require('../jobs/index');
    registerJobs();

    expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
  });
});

// ---------- Test 2-4: syncHotcaseGv ----------

describe('syncHotcaseGv', () => {
  let syncHotcaseGv: () => Promise<{ created: number; skipped: number }>;

  beforeAll(() => {
    syncHotcaseGv = require('../jobs/sync-hotcase-gv.job').syncHotcaseGv;
  });

  // Helper: mock filterHotcase queries (dataSql + countSql)
  function mockFilterHotcase(events: any[]) {
    mockQuery.mockResolvedValueOnce(events); // dataSql
    mockQuery.mockResolvedValueOnce([{ total: events.length }]); // countSql
  }

  // Helper: mock createAuditProcess success path (all MySQL, no SQLite)
  // bp_cuie_details resolve, CHPT lookup, dup check, resolveCtiData (CLAG + SSTE + VCR), INSERT CHPI, fetch CHST (empty)
  function mockCreateSuccess() {
    mockQuery.mockResolvedValueOnce([{ mypt: 'PT1', mygg: 'GG1', mylcp: 'LCP1', mylct: 'LCT1', myulc: 'ULC-001' }]); // bp_cuie_details resolve
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-GE', name: 'Hotcase Template', mylcet: 'HOT' }]); // CHPT lookup
    mockQuery.mockResolvedValueOnce([]); // dup check (no duplicate)
    mockQuery.mockResolvedValueOnce([{ clag_code: 'CLAG-001' }]); // resolveCtiData: CLAG from bp_usi_vcr_meeting
    mockQuery.mockResolvedValueOnce([]); // resolveCtiData: SSTE slide query
    mockQuery.mockResolvedValueOnce([]); // resolveCtiData: VCR video query
    mockQuery.mockResolvedValueOnce([]); // INSERT CHPI
    mockQuery.mockResolvedValueOnce([]); // fetch CHST (no steps)
  }

  // Helper: mock createAuditProcess duplicate (409)
  function mockCreateDuplicate() {
    mockQuery.mockResolvedValueOnce([{ mypt: 'PT1', mygg: 'GG1', mylct: 'LCT1', mylck: 'GE' }]); // bp_cuie_details resolve
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-GE', name: 'Hotcase Template', mylcet: 'HOT' }]); // CHPT lookup
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_EXISTING' }]); // dup check → found
  }

  it('should detect unprocessed HOT events and create HOTCASE CHPI for each', async () => {
    const events = [
      { cuie_code: 'CUIE_HOT_001', hot_reason: 'Bad feedback', usi_code: 'USI-TE001', gv_name: 'Teacher A', trigger_at: '2026-02-10 14:00:00' },
      { cuie_code: 'CUIE_HOT_002', hot_reason: 'Student complaint', usi_code: 'USI-TE002', gv_name: 'Teacher B', trigger_at: '2026-02-10 15:00:00' },
    ];

    mockFilterHotcase(events);
    mockCreateSuccess(); // event 1
    mockCreateSuccess(); // event 2

    const result = await syncHotcaseGv();

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    // filterHotcase: 2 queries + createAuditProcess: 8 MySQL queries per event x 2 = 16
    expect(mockQuery).toHaveBeenCalledTimes(18);
  });

  it('should skip already-processed HOT events (duplicate 409)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const events = [
      { cuie_code: 'CUIE_HOT_001', hot_reason: 'Bad feedback', usi_code: 'USI-TE001', gv_name: 'Teacher A', trigger_at: '2026-02-10 14:00:00' },
      { cuie_code: 'CUIE_HOT_002', hot_reason: 'Student complaint', usi_code: 'USI-TE002', gv_name: 'Teacher B', trigger_at: '2026-02-10 15:00:00' },
    ];

    mockFilterHotcase(events);
    mockCreateSuccess();    // event 1 succeeds
    mockCreateDuplicate();  // event 2 already processed

    const result = await syncHotcaseGv();

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('CUIE_HOT_002'));

    warnSpy.mockRestore();
  });

  it('should log summary with hotcase_created count', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const events = [
      { cuie_code: 'CUIE_HOT_001', hot_reason: 'Bad feedback', usi_code: 'USI-TE001', gv_name: 'Teacher A', trigger_at: '2026-02-10 14:00:00' },
    ];

    mockFilterHotcase(events);
    mockCreateSuccess();

    await syncHotcaseGv();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('hotcase_created: 1'));

    logSpy.mockRestore();
  });
});
