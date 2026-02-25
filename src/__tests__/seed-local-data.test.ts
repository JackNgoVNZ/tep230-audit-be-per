import 'reflect-metadata';

const mockCount = jest.fn();
const mockSave = jest.fn();
const mockGetRepository = jest.fn().mockReturnValue({
  count: mockCount,
  save: mockSave,
});

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));

jest.mock('../config/local-database', () => ({
  LocalDataSource: {
    isInitialized: true,
    query: jest.fn(),
    getRepository: mockGetRepository,
  },
}));

import { seedLocalData } from '../config/seed-local-data';

describe('seedLocalData', () => {
  beforeEach(() => {
    mockCount.mockReset();
    mockSave.mockReset();
    mockGetRepository.mockClear();
  });

  it('should seed threshold and email data when tables are empty', async () => {
    // First call for threshold count, second for email count
    mockCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockSave.mockResolvedValue([]);

    await seedLocalData();

    // getRepository called twice (threshold + email)
    expect(mockGetRepository).toHaveBeenCalledTimes(2);
    // save called twice (11 thresholds + 5 emails)
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[0][0]).toHaveLength(11);
    expect(mockSave.mock.calls[1][0]).toHaveLength(5);
  });

  it('should be idempotent — skip when data already exists', async () => {
    mockCount.mockResolvedValueOnce(11).mockResolvedValueOnce(5);

    await seedLocalData();

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('should seed only email templates when thresholds exist', async () => {
    mockCount.mockResolvedValueOnce(11).mockResolvedValueOnce(0);
    mockSave.mockResolvedValue([]);

    await seedLocalData();

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0]).toHaveLength(5);
  });
});
