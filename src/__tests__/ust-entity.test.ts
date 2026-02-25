import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { UstUserType } from '../entities/ust-usertype.entity';

describe('UstUserType entity', () => {
  it('should be defined as a class', () => {
    expect(UstUserType).toBeDefined();
    expect(typeof UstUserType).toBe('function');
  });

  it('should map to table bp_ust_usertype', () => {
    const tables = getMetadataArgsStorage().tables;
    const ustTable = tables.find((t) => t.target === UstUserType);
    expect(ustTable).toBeDefined();
    expect(ustTable!.name).toBe('bp_ust_usertype');
  });

  it('should have id as a primary generated column', () => {
    const generatedColumns = getMetadataArgsStorage().generations;
    const idGen = generatedColumns.find(
      (g) => g.target === UstUserType && g.propertyName === 'id'
    );
    expect(idGen).toBeDefined();
  });

  it('should have at least 8 column mappings', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === UstUserType
    );
    expect(columns.length).toBeGreaterThanOrEqual(8);
  });

  it('should have code column with unique constraint', () => {
    const columns = getMetadataArgsStorage().columns;
    const codeCol = columns.find(
      (c) => c.target === UstUserType && c.propertyName === 'code'
    );
    expect(codeCol).toBeDefined();
    expect(codeCol!.options.unique).toBe(true);
  });

  it('should be instantiable', () => {
    const type = new UstUserType();
    expect(type).toBeInstanceOf(UstUserType);
  });
});
