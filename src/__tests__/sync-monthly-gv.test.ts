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

describe('registerJobs — monthly', () => {
  it('should register SyncMonthlyGV with cron expression 0 6 1 * *', () => {
    const { registerJobs } = require('../jobs/index');
    registerJobs();

    expect(cron.schedule).toHaveBeenCalledWith('0 6 1 * *', expect.any(Function));
  });
});

// ---------- Test 2-4: syncMonthlyGv ----------

describe('syncMonthlyGv', () => {
  let syncMonthlyGv: () => Promise<{ inherited: number; created: number; skipped: number }>;

  beforeAll(() => {
    syncMonthlyGv = require('../jobs/sync-monthly-gv.job').syncMonthlyGv;
  });

  /**
   * Mock CAP resolution (1 query) + filterMonthly queries (all MySQL, no SQLite):
   * 1. CAP code resolution → [{ code: 'CAP-2026-M02' }]
   * 2. filterMonthly: CAP lookup → full CAP row
   * 3. filterMonthly: inherited WEEKLY GVs (MySQL)
   * 4. filterMonthly: new audit GVs (MySQL)
   * 5. filterMonthly: enrich new rows (MySQL, only if newAudit.length > 0)
   * 6. filterMonthly: count query
   */
  function mockCapAndFilterMonthly(opts: {
    inherited: any[];
    newAudit: any[];
  }) {
    const { inherited, newAudit } = opts;
    const total = inherited.length + newAudit.length;

    // 1. CAP code resolution (in job)
    mockQuery.mockResolvedValueOnce([{ code: 'CAP-2026-M02' }]);
    // 2. filterMonthly: CAP lookup
    mockQuery.mockResolvedValueOnce([{ code: 'CAP-2026-M02', description: 'February 2026', startperiod: '2026-02-01', endperiod: '2026-02-28' }]);
    // 3. filterMonthly: inherited WEEKLY GVs (MySQL)
    mockQuery.mockResolvedValueOnce(inherited);
    // 4. filterMonthly: new audit GVs (MySQL newSql)
    mockQuery.mockResolvedValueOnce(newAudit);
    // 5. filterMonthly: enrich new rows (only when newAudit.length > 0)
    if (newAudit.length > 0) {
      mockQuery.mockResolvedValueOnce(
        newAudit.map((g: any) => ({ myusi: g.usi_code, cuie_code: g.selected_cuie_code, trigger_at: g.trigger_at, mypt: null, mygg: null, mylct: null })),
      );
    }
    // 6. filterMonthly: count
    mockQuery.mockResolvedValueOnce([{ total }]);
  }

  // Helper: mock createAuditProcess success (all MySQL, no SQLite)
  function mockCreateSuccess() {
    mockQuery.mockResolvedValueOnce([{ mypt: 'PT1', mygg: 'GG1', mylcp: 'LCP1', mylct: 'LCT1', myulc: 'ULC-001' }]); // bp_cuie_details resolve
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-GE', name: 'Monthly Template', mylcet: 'JSU' }]); // CHPT lookup
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
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-GE', name: 'Monthly Template', mylcet: 'JSU' }]); // CHPT lookup
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_EXISTING' }]); // dup found
  }

  it('should inherit WEEKLY GVs and create MONTHLY for new audit GVs', async () => {
    mockCapAndFilterMonthly({
      inherited: [{ usi_code: 'USI-TE001', gv_name: 'Teacher A', weekly_chpi_code: 'CHPI_W_001' }],
      newAudit: [{ usi_code: 'USI-TE002', gv_name: 'Teacher B', selected_cuie_code: 'CUIE-JSU-201', trigger_at: '2026-02-10 09:00:00' }],
    });
    mockCreateSuccess(); // only NEW_AUDIT GV gets createAuditProcess

    const result = await syncMonthlyGv();

    expect(result.inherited).toBe(1);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('should handle createAuditProcess failure for NEW_AUDIT GVs gracefully', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockCapAndFilterMonthly({
      inherited: [],
      newAudit: [
        { usi_code: 'USI-TE001', gv_name: 'Teacher A', selected_cuie_code: 'CUIE-JSU-101', trigger_at: '2026-02-05 09:00:00' },
        { usi_code: 'USI-TE002', gv_name: 'Teacher B', selected_cuie_code: 'CUIE-JSU-102', trigger_at: '2026-02-06 09:00:00' },
      ],
    });
    mockCreateSuccess();    // GV 1 succeeds
    mockCreateDuplicate();  // GV 2 fails (409)

    const result = await syncMonthlyGv();

    expect(result.inherited).toBe(0);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('USI-TE002'));

    warnSpy.mockRestore();
  });

  it('should log summary with inherited and monthly_created counts', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockCapAndFilterMonthly({
      inherited: [{ usi_code: 'USI-TE001', gv_name: 'Teacher A', weekly_chpi_code: 'CHPI_W_001' }],
      newAudit: [{ usi_code: 'USI-TE002', gv_name: 'Teacher B', selected_cuie_code: 'CUIE-JSU-201', trigger_at: '2026-02-10 09:00:00' }],
    });
    mockCreateSuccess();

    await syncMonthlyGv();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('inherited: 1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('monthly_created: 1'));

    logSpy.mockRestore();
  });
});
