jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import { AppDataSource } from '../config/database';
import { ScoringService } from '../modules/scoring/scoring.service';

const mockQuery = AppDataSource.query as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
});

const ORIG_CHPI = {
  code: 'CHPI_001',
  name: 'Onboard Audit',
  mychpt: 'PT1-GG1-LCK1',
  mychpttype: 'ONB-AUDIT',
  mylcet: 'EVT-1',
  mytrigger: 'USI-TE001',
  myulc: 'ULC-01',
  myclag: 'CLAG-01',
  description: 'CUIE-001',
};

const ORIG_STEPS = [
  { code: 'CHSI_001_01', name: 'Step 1', checksample: 3, mychst: 'CHST-A' },
  { code: 'CHSI_001_02', name: 'Step 2', checksample: 2, mychst: 'CHST-B' },
];

const ORIG_ITEMS_STEP1 = [
  { subcode: 'S1', name: 'Item 1', myparentchlt: null, mysubchlt: 'CHLT-1', do: 'Do X', donot: 'Dont Y', correctexample: 'Ex1', incorrectexample: 'Ex2', scoretype1: 'SCORE', score1: '3', scoretype2: null, score2: null },
];

const ORIG_ITEMS_STEP2 = [
  { subcode: 'S2', name: 'Item 2', myparentchlt: null, mysubchlt: 'CHLT-2', do: 'Do A', donot: 'Dont B', correctexample: null, incorrectexample: null, scoretype1: 'SCORE', score1: '5', scoretype2: null, score2: null },
];

function setupCreateRetrainingMocks() {
  // 1. Check existing retraining via MySQL CHPI (WHERE mychpttype = 'RTR-AUDIT' AND description = ?)
  mockQuery.mockResolvedValueOnce([]);
  // 2. Get original CHPI
  mockQuery.mockResolvedValueOnce([ORIG_CHPI]);
  // 3. INSERT new CHPI (status='Assigned')
  mockQuery.mockResolvedValueOnce(undefined);
  // 4. Get original steps
  mockQuery.mockResolvedValueOnce(ORIG_STEPS);
  // 5. INSERT step 1 (status='Assigned')
  mockQuery.mockResolvedValueOnce(undefined);
  // 6. Get items for step 1
  mockQuery.mockResolvedValueOnce(ORIG_ITEMS_STEP1);
  // 7. INSERT item 1 (status='Assigned')
  mockQuery.mockResolvedValueOnce(undefined);
  // 8. INSERT step 2 (status='Assigned')
  mockQuery.mockResolvedValueOnce(undefined);
  // 9. Get items for step 2
  mockQuery.mockResolvedValueOnce(ORIG_ITEMS_STEP2);
  // 10. INSERT item 2 (status='Assigned')
  mockQuery.mockResolvedValueOnce(undefined);
}

describe('createRetrainingAudit', () => {
  const service = new ScoringService();

  it('creates new CHPI in MySQL with RETRAINING type', async () => {
    setupCreateRetrainingMocks();

    const result = await service.createRetrainingAudit('CHPI_001');

    expect(result).toBeTruthy();
    // Find the CHPI INSERT call
    const chpiInsert = mockQuery.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO bp_chpi_checkprocessitem'),
    );
    expect(chpiInsert).toBeDefined();
    expect(chpiInsert![1]).toEqual(
      expect.arrayContaining([expect.stringContaining('ULC-01_RTR-AUDIT_USI-TE001')]),
    );
  });

  it('new CHPI has cloned CHSI and CHLI from original', async () => {
    setupCreateRetrainingMocks();

    await service.createRetrainingAudit('CHPI_001');

    const chsiInserts = mockQuery.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO bp_chsi_checkstepitem'),
    );
    expect(chsiInserts.length).toBe(2);

    const chliInserts = mockQuery.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO bp_chli_checklistitem'),
    );
    expect(chliInserts.length).toBe(2);
  });

  it('new CHPI has mychpttype=RETRAINING and status=Assigned', async () => {
    setupCreateRetrainingMocks();

    await service.createRetrainingAudit('CHPI_001');

    // Find the CHPI INSERT and verify it includes RETRAINING and Assigned
    const chpiInsert = mockQuery.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO bp_chpi_checkprocessitem'),
    );
    expect(chpiInsert).toBeDefined();
    expect(chpiInsert![0]).toContain('RTR-AUDIT');
    expect(chpiInsert![0]).toContain('Assigned');
  });

  it('CHSI steps are created with status=Assigned', async () => {
    setupCreateRetrainingMocks();

    await service.createRetrainingAudit('CHPI_001');

    const chsiInserts = mockQuery.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO bp_chsi_checkstepitem'),
    );
    for (const insert of chsiInserts) {
      expect(insert[0]).toContain('Assigned');
    }
  });

  it('description stores original CHPI code for parent reference', async () => {
    setupCreateRetrainingMocks();

    await service.createRetrainingAudit('CHPI_001');

    const chpiInsert = mockQuery.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO bp_chpi_checkprocessitem'),
    );
    // description param should be the original CHPI code
    expect(chpiInsert![1]).toContain('CHPI_001');
  });

  it('does NOT create if retraining already exists for same parent', async () => {
    // Existing retraining found via MySQL CHPI
    mockQuery.mockResolvedValueOnce([{ code: 'CHPI_RETRAINING_EXISTING' }]);

    const result = await service.createRetrainingAudit('CHPI_001');

    expect(result).toBeNull();
    // No CHPI INSERT should have been called (only the existing check query)
    const chpiInserts = mockQuery.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO bp_chpi'),
    );
    expect(chpiInserts.length).toBe(0);
  });

  it('CHLI scores are reset to null in cloned items', async () => {
    setupCreateRetrainingMocks();

    await service.createRetrainingAudit('CHPI_001');

    const chliInserts = mockQuery.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO bp_chli_checklistitem'),
    );
    // Each CHLI INSERT params should have null for score1 and score2 (positions 11 and 13)
    for (const insert of chliInserts) {
      const params = insert[1];
      expect(params[11]).toBeNull(); // score1
      expect(params[13]).toBeNull(); // score2
    }
  });
});
