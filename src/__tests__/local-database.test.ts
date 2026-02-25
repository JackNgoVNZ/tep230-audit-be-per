import 'reflect-metadata';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));

import { LocalDataSource } from '../config/local-database';
import { AppDataSource } from '../config/database';

describe('LocalDataSource (MySQL alias)', () => {
  it('should be the same reference as AppDataSource', () => {
    expect(LocalDataSource).toBe(AppDataSource);
  });

  it('should expose query method', () => {
    expect(typeof LocalDataSource.query).toBe('function');
  });

  it('should expose isInitialized property', () => {
    expect(LocalDataSource.isInitialized).toBe(true);
  });
});
