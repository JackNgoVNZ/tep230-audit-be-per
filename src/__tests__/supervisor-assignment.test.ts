import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import app from '../app';
import { AppDataSource } from '../config/database';

const mockQuery = AppDataSource.query as jest.Mock;

function makeToken(role: string, code = 'TEST_USER'): string {
  return jwt.sign(
    { usi_code: code, fullname: 'Test User', myust: role },
    'default-jwt-secret',
    { expiresIn: 86400 }
  );
}

let adminToken: string;
let qalToken: string;
let qaToken: string;

beforeAll(() => {
  adminToken = makeToken('AD');
  qalToken = makeToken('QS');
  qaToken = makeToken('QA');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('Supervisor Assignment API', () => {
  describe('GET /api/supervisors/auditors', () => {
    it('returns QA users', async () => {
      mockQuery.mockResolvedValueOnce([
        { code: 'USI-QA01', fullname: 'Auditor 1', email: 'qa1@clevai.vn' },
      ]);

      const res = await request(app)
        .get('/api/supervisors/auditors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe('USI-QA01');
    });
  });

  describe('GET /api/supervisors/auditor/:code/completed-sessions', () => {
    it('returns completed sessions for auditor from MySQL', async () => {
      // MySQL query: CHPI WHERE mychecker = ? AND status = 'Audited'
      mockQuery.mockResolvedValueOnce([
        { chpi_code: 'CHPI_001', name: 'Audit 1', audit_type: 'ONB-AUDIT', mychecker: 'USI-QA01', status: 'Audited', completed_at: '2026-02-10', gv_name: 'Teacher A' },
      ]);

      const res = await request(app)
        .get('/api/supervisors/auditor/USI-QA01/completed-sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].chpi_code).toBe('CHPI_001');
      // New response shape: total_score, threshold_result, supervisor_code are all null
      expect(res.body.data[0].total_score).toBeNull();
      expect(res.body.data[0].threshold_result).toBeNull();
      expect(res.body.data[0].supervisor_code).toBeNull();
    });
  });

  describe('POST /api/supervisors/assign', () => {
    it('updates supervisor via CHPI description tag [SUP:code]', async () => {
      // QAL check
      mockQuery.mockResolvedValueOnce([{ code: 'USI-QAL01' }]);
      // Update CHPI description with [SUP:code] via MySQL
      mockQuery.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/api/supervisors/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ chpiCodes: ['CHPI_001', 'CHPI_002'], supervisorCode: 'USI-QAL01' });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2);

      // Verify the UPDATE query uses CONCAT with [SUP: tag
      const updateCall = mockQuery.mock.calls.find(
        (call: any[]) => (call[0] as string).includes('[SUP:'),
      );
      expect(updateCall).toBeDefined();
    });

    it('validates chpiCodes non-empty array', async () => {
      const res = await request(app)
        .post('/api/supervisors/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ chpiCodes: [], supervisorCode: 'USI-QAL01' });

      expect(res.status).toBe(400);
    });

    it('validates supervisorCode is QAL user', async () => {
      // QAL check returns empty → not QAL
      mockQuery.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/supervisors/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ chpiCodes: ['CHPI_001'], supervisorCode: 'USI-QA01' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('QAL');
    });
  });

  describe('Role restrictions', () => {
    it('only AD/TO can access (403 for QS)', async () => {
      const res = await request(app)
        .get('/api/supervisors/auditors')
        .set('Authorization', `Bearer ${qalToken}`);

      expect(res.status).toBe(403);
    });

    it('only AD/TO can access (403 for QA)', async () => {
      const res = await request(app)
        .get('/api/supervisors/auditors')
        .set('Authorization', `Bearer ${qaToken}`);

      expect(res.status).toBe(403);
    });

    it('401 without token', async () => {
      const res = await request(app).get('/api/supervisors/auditors');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/supervisors/', () => {
    it('returns assigned sessions from MySQL', async () => {
      // Count query
      mockQuery.mockResolvedValueOnce([{ cnt: 1 }]);
      // Data query: completed CHPI records from MySQL
      mockQuery.mockResolvedValueOnce([
        { chpi_code: 'CHPI_001', name: 'Audit 1', audit_type: 'ONB-AUDIT', status: 'Audited', mychecker: 'USI-QA01', gv_name: 'Teacher A', auditor_name: 'Auditor 1' },
      ]);

      const res = await request(app)
        .get('/api/supervisors/')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      // New response shape: supervisor_code and total_score are null
      expect(res.body.data[0].supervisor_code).toBeNull();
      expect(res.body.data[0].total_score).toBeNull();
    });
  });
});
