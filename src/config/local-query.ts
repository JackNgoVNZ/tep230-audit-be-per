import { LocalDataSource } from './local-database';

export async function localQuery(sql: string, params?: any[]): Promise<any> {
  return LocalDataSource.query(sql, params);
}
