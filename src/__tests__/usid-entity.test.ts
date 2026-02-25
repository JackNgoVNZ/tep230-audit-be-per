import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { UsidUsiDuty } from '../entities/usid-usiduty.entity';

describe('UsidUsiDuty entity', () => {
  it('should be defined as a class', () => {
    expect(UsidUsiDuty).toBeDefined();
    expect(typeof UsidUsiDuty).toBe('function');
  });

  it('should map to table bp_usid_usiduty', () => {
    const tables = getMetadataArgsStorage().tables;
    const usidTable = tables.find((t) => t.target === UsidUsiDuty);
    expect(usidTable).toBeDefined();
    expect(usidTable!.name).toBe('bp_usid_usiduty');
  });

  it('should have id as a primary generated column', () => {
    const generatedColumns = getMetadataArgsStorage().generations;
    const idGen = generatedColumns.find(
      (g) => g.target === UsidUsiDuty && g.propertyName === 'id'
    );
    expect(idGen).toBeDefined();
  });

  it('should have at least 5 column mappings', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === UsidUsiDuty
    );
    expect(columns.length).toBeGreaterThanOrEqual(5);
  });

  it('should have code column with unique constraint', () => {
    const columns = getMetadataArgsStorage().columns;
    const codeCol = columns.find(
      (c) => c.target === UsidUsiDuty && c.propertyName === 'code'
    );
    expect(codeCol).toBeDefined();
    expect(codeCol!.options.unique).toBe(true);
  });

  it('should have myusi column referencing user', () => {
    const columns = getMetadataArgsStorage().columns;
    const myusiCol = columns.find(
      (c) => c.target === UsidUsiDuty && c.propertyName === 'myusi'
    );
    expect(myusiCol).toBeDefined();
    expect(myusiCol!.options.type).toBe('varchar');
  });

  it('should be instantiable', () => {
    const duty = new UsidUsiDuty();
    expect(duty).toBeInstanceOf(UsidUsiDuty);
  });
});
