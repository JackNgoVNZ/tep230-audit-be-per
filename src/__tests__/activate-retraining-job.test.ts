jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import { AppDataSource } from '../config/database';
import { activateRetraining } from '../jobs/activate-retraining.job';

const mockQuery = AppDataSource.query as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
});

describe('activateRetraining job', () => {
  it("queries CHPI WHERE mychpttype=RETRAINING AND status = 'Open' AND created_at <= 7 days ago", async () => {
    mockQuery.mockResolvedValueOnce({ affectedRows: 2 });

    await activateRetraining();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain("mychpttype = 'RTR-AUDIT'");
    expect(sql).toContain("status = 'Open'");
    expect(sql).toContain('DATE_SUB(NOW(), INTERVAL 7 DAY)');
  });

  it('matching sessions updated to status=Assigned', async () => {
    mockQuery.mockResolvedValueOnce({ affectedRows: 3 });

    const result = await activateRetraining();

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain("SET status = 'Assigned'");
    expect(result).toBe(3);
  });

  it('returns 0 when no sessions match', async () => {
    mockQuery.mockResolvedValueOnce({ affectedRows: 0 });

    const result = await activateRetraining();

    expect(result).toBe(0);
  });

  it('UPDATE query targets MySQL bp_chpi_checkprocessitem', async () => {
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    await activateRetraining();

    const sql = mockQuery.mock.calls[0][0];
    // Verify it's an UPDATE on the MySQL CHPI table
    expect(sql).toMatch(/UPDATE\s+bp_chpi_checkprocessitem/i);
    expect(sql).toContain("mychpttype = 'RTR-AUDIT'");
  });
});
