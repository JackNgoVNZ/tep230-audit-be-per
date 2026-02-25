import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { UsiUserItem } from '../entities/usi-useritem.entity';

describe('UsiUserItem entity', () => {
  it('should be defined as a class', () => {
    expect(UsiUserItem).toBeDefined();
    expect(typeof UsiUserItem).toBe('function');
  });

  it('should map to table bp_usi_useritem', () => {
    const tables = getMetadataArgsStorage().tables;
    const usiTable = tables.find((t) => t.target === UsiUserItem);
    expect(usiTable).toBeDefined();
    expect(usiTable!.name).toBe('bp_usi_useritem');
  });

  it('should have id as a primary generated column', () => {
    const generatedColumns = getMetadataArgsStorage().generations;
    const idGen = generatedColumns.find(
      (g) => g.target === UsiUserItem && g.propertyName === 'id'
    );
    expect(idGen).toBeDefined();
  });

  it('should have at least 20 column mappings', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === UsiUserItem
    );
    expect(columns.length).toBeGreaterThanOrEqual(20);
  });

  it('should have password and password_salt marked with select: false', () => {
    const columns = getMetadataArgsStorage().columns;
    const pwCol = columns.find(
      (c) => c.target === UsiUserItem && c.propertyName === 'password'
    );
    const saltCol = columns.find(
      (c) => c.target === UsiUserItem && c.propertyName === 'password_salt'
    );
    expect(pwCol).toBeDefined();
    expect(pwCol!.options.select).toBe(false);
    expect(saltCol).toBeDefined();
    expect(saltCol!.options.select).toBe(false);
  });

  it('should be instantiable', () => {
    const user = new UsiUserItem();
    expect(user).toBeInstanceOf(UsiUserItem);
  });
});
