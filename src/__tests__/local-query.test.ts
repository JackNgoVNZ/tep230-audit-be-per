jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));

jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import { localQuery } from '../config/local-query';
import { LocalDataSource } from '../config/local-database';

const mockQuery = LocalDataSource.query as jest.Mock;

describe('localQuery helper', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('should execute SELECT queries with parameters', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const rows = await localQuery(
      'SELECT * FROM audit_threshold_config WHERE audit_type = ?',
      ['ONB-AUDIT']
    );
    expect(rows.length).toBe(3);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM audit_threshold_config WHERE audit_type = ?',
      ['ONB-AUDIT']
    );
  });

  it('should execute SELECT queries without parameters', async () => {
    mockQuery.mockResolvedValueOnce([{ count: 5 }]);

    const rows = await localQuery('SELECT COUNT(*) as count FROM audit_email_template');
    expect(Number(rows[0].count)).toBe(5);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM audit_email_template',
      undefined
    );
  });
});
