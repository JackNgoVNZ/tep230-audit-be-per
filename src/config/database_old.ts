import { DataSource } from 'typeorm';
import path from 'path';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'mysql.clevai.vn',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'aiagent',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'staging_s2_bp_log_v2',
  entities: [path.join(__dirname, '..', 'entities', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  charset: 'utf8mb4',
  extra: {
    connectionLimit: 10,
  },
});
