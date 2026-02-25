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

describe('registerJobs', () => {
  it('should register SyncOnboardGV with cron expression 0 6 * * *', () => {
    const { registerJobs } = require('../jobs/index');
    registerJobs();

    expect(cron.schedule).toHaveBeenCalledWith('0 6 * * *', expect.any(Function));
  });
});

// ---------- Test 2-5: syncOnboardGv ----------

describe('syncOnboardGv', () => {
  let syncOnboardGv: () => Promise<{ created: number; skipped: number }>;

  beforeAll(() => {
    syncOnboardGv = require('../jobs/sync-onboard-gv.job').syncOnboardGv;
  });

  // Helper: mock candidateSql query (single query returning candidates from bp_cuie_details)
  function mockCandidates(gvs: any[]) {
    mockQuery.mockResolvedValueOnce(
      gvs.map((g: any) => ({ usi_code: g.usi_code, first_jsu_cuie_code: g.first_jsu_cuie_code })),
    );
  }

  // Helper: mock createAuditProcess queries for one GV (success path)
  // bp_cuie_details resolve, CHPT lookup, dup check, resolveCtiData (CLAG + SSTE + VCR), INSERT CHPI, fetch CHST (empty)
  function mockCreateSuccess() {
    mockQuery.mockResolvedValueOnce([{ mypt: 'PT1', mygg: 'GG1', mylcp: 'LCP1', mylct: 'LCT1', myulc: 'ULC-001' }]); // bp_cuie_details resolve
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-GE', name: 'Onboard Template', mylcet: 'JSU' }]); // CHPT lookup
    mockQuery.mockResolvedValueOnce([]); // dup check (no duplicate)
    mockQuery.mockResolvedValueOnce([{ clag_code: 'CLAG-001' }]); // resolveCtiData: CLAG from bp_usi_vcr_meeting
    mockQuery.mockResolvedValueOnce([]); // resolveCtiData: SSTE slide query
    mockQuery.mockResolvedValueOnce([]); // resolveCtiData: VCR video query
    mockQuery.mockResolvedValueOnce([]); // INSERT CHPI
    mockQuery.mockResolvedValueOnce([]); // fetch CHST (no steps for simplicity)
  }

  // Helper: mock createAuditProcess failing at dup check (409)
  function mockCreateDuplicate() {
    mockQuery.mockResolvedValueOnce([{ mypt: 'PT1', mygg: 'GG1', mylct: 'LCT1', mylck: 'GE' }]); // bp_cuie_details resolve
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-GE', name: 'Onboard Template', mylcet: 'JSU' }]); // CHPT lookup
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_EXISTING' }]); // dup check → found
  }

  it('should query candidates and createAuditProcess for each GV', async () => {
    const gvs = [
      { usi_code: 'USI-TE001', first_jsu_cuie_code: 'CUIE_001' },
      { usi_code: 'USI-TE002', first_jsu_cuie_code: 'CUIE_002' },
    ];

    mockCandidates(gvs);
    mockCreateSuccess(); // GV 1
    mockCreateSuccess(); // GV 2

    const result = await syncOnboardGv();

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    // candidateSql: 1 query + createAuditProcess: 8 MySQL queries per GV x 2 = 16
    expect(mockQuery).toHaveBeenCalledTimes(17);
  });

  it('should handle individual GV failure gracefully (skip, continue others)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const gvs = [
      { usi_code: 'USI-TE001', first_jsu_cuie_code: 'CUIE_001' },
      { usi_code: 'USI-TE002', first_jsu_cuie_code: 'CUIE_002' },
    ];

    mockCandidates(gvs);
    mockCreateSuccess();    // GV 1 succeeds
    mockCreateDuplicate();  // GV 2 fails (409 duplicate)

    const result = await syncOnboardGv();

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('USI-TE002'));

    warnSpy.mockRestore();
  });

  it('should log summary with onboard_created count', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const gvs = [
      { usi_code: 'USI-TE001', first_jsu_cuie_code: 'CUIE_001' },
    ];

    mockCandidates(gvs);
    mockCreateSuccess();

    await syncOnboardGv();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('onboard_created: 1'));

    logSpy.mockRestore();
  });

  it('should not create audits when filterOnboard returns empty (re-run dedup)', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockCandidates([]); // no new GVs

    const result = await syncOnboardGv();

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    // Only candidateSql: 1 query, no createAuditProcess calls
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('onboard_created: 0'));

    logSpy.mockRestore();
  });
});
