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

describe('registerJobs — weekly', () => {
  it('should register SyncWeeklyGV with cron expression 0 6 * * 1', () => {
    const { registerJobs } = require('../jobs/index');
    registerJobs();

    expect(cron.schedule).toHaveBeenCalledWith('0 6 * * 1', expect.any(Function));
  });
});

// ---------- Test 2-4: syncWeeklyGv ----------

describe('syncWeeklyGv', () => {
  let syncWeeklyGv: () => Promise<{ created: number; skipped: number }>;

  beforeAll(() => {
    syncWeeklyGv = require('../jobs/sync-weekly-gv.job').syncWeeklyGv;
  });

  // Helper: mock CAP code resolution (1 query) + filterWeekly queries (3-4 queries: CAP lookup, data, count, enrich if data.length > 0)
  function mockCapAndFilterWeekly(gvs: any[]) {
    // 1. CAP code resolution query in the job itself
    mockQuery.mockResolvedValueOnce([{ code: 'CAP-2026-W06' }]);
    // 2. filterWeekly: CAP lookup
    mockQuery.mockResolvedValueOnce([{ code: 'CAP-2026-W06', description: 'Week 06 2026', startperiod: '2026-02-02', endperiod: '2026-02-08' }]);
    // 3. filterWeekly: data query
    mockQuery.mockResolvedValueOnce(gvs);
    // 4. filterWeekly: count query
    mockQuery.mockResolvedValueOnce([{ total: gvs.length }]);
    // 5. filterWeekly: enrich cuie batch (only when data.length > 0)
    if (gvs.length > 0) {
      mockQuery.mockResolvedValueOnce(
        gvs.map((g: any) => ({ myusi: g.usi_code, cuie_code: g.selected_cuie_code, trigger_at: g.trigger_at })),
      );
    }
  }

  // Helper: mock createAuditProcess success (all MySQL, no SQLite)
  function mockCreateSuccess() {
    mockQuery.mockResolvedValueOnce([{ mypt: 'PT1', mygg: 'GG1', mylcp: 'LCP1', mylct: 'LCT1', myulc: 'ULC-001' }]); // bp_cuie_details resolve
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-GE', name: 'Weekly Template', mylcet: 'JSU' }]); // CHPT lookup
    mockQuery.mockResolvedValueOnce([]); // dup check
    mockQuery.mockResolvedValueOnce([{ clag_code: 'CLAG-001' }]); // resolveCtiData: CLAG from bp_usi_vcr_meeting
    mockQuery.mockResolvedValueOnce([]); // resolveCtiData: SSTE slide query
    mockQuery.mockResolvedValueOnce([]); // resolveCtiData: VCR video query
    mockQuery.mockResolvedValueOnce([]); // INSERT CHPI
    mockQuery.mockResolvedValueOnce([]); // fetch CHST (empty)
  }

  // Helper: mock createAuditProcess duplicate (409)
  function mockCreateDuplicate() {
    mockQuery.mockResolvedValueOnce([{ mypt: 'PT1', mygg: 'GG1', mylct: 'LCT1', mylck: 'GE' }]); // bp_cuie_details resolve
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-GE', name: 'Weekly Template', mylcet: 'JSU' }]); // CHPT lookup
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_EXISTING' }]); // dup found
  }

  it('should select GVs and create WEEKLY CHPI for each', async () => {
    const gvs = [
      { usi_code: 'USI-TE001', gv_name: 'Teacher A', selected_cuie_code: 'CUIE-JSU-101', trigger_at: '2026-02-03 09:00:00' },
      { usi_code: 'USI-TE002', gv_name: 'Teacher B', selected_cuie_code: 'CUIE-JSU-102', trigger_at: '2026-02-04 10:00:00' },
    ];

    mockCapAndFilterWeekly(gvs);
    mockCreateSuccess(); // GV 1
    mockCreateSuccess(); // GV 2

    const result = await syncWeeklyGv();

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    // CAP resolution: 1 + filterWeekly: 4 (CAP + data + count + enrich) + createAuditProcess: 8 per GV x 2 = 21
    expect(mockQuery).toHaveBeenCalledTimes(21);
  });

  it('should handle createAuditProcess failure gracefully (skip, continue)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const gvs = [
      { usi_code: 'USI-TE001', gv_name: 'Teacher A', selected_cuie_code: 'CUIE-JSU-101', trigger_at: '2026-02-03 09:00:00' },
      { usi_code: 'USI-TE002', gv_name: 'Teacher B', selected_cuie_code: 'CUIE-JSU-102', trigger_at: '2026-02-04 10:00:00' },
    ];

    mockCapAndFilterWeekly(gvs);
    mockCreateSuccess();    // GV 1 succeeds
    mockCreateDuplicate();  // GV 2 fails (409)

    const result = await syncWeeklyGv();

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('USI-TE002'));

    warnSpy.mockRestore();
  });

  it('should log summary with weekly_created count', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const gvs = [
      { usi_code: 'USI-TE001', gv_name: 'Teacher A', selected_cuie_code: 'CUIE-JSU-101', trigger_at: '2026-02-03 09:00:00' },
    ];

    mockCapAndFilterWeekly(gvs);
    mockCreateSuccess();

    await syncWeeklyGv();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('weekly_created: 1'));

    logSpy.mockRestore();
  });
});
