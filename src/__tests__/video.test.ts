import request from 'supertest';

jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import app from '../app';
import { AppDataSource } from '../config/database';

const mockQuery = AppDataSource.query as jest.Mock;

async function getToken(username: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'audit@2024' });
  return res.body.access_token;
}

let adminToken: string;

beforeAll(async () => {
  adminToken = await getToken('admin');
});

beforeEach(() => {
  mockQuery.mockReset();
});

// ================================================================
// GET /api/video/by-session/:chpiCode
// ================================================================

describe('GET /api/video/by-session/:chpiCode', () => {
  it('should return videos from mycti2 JSON when available (no VCR query needed) → 200', async () => {
    const videoUrls = ['https://video.example.com/1', 'https://video.example.com/2'];
    // Query 1: CHPI lookup
    mockQuery.mockResolvedValueOnce([
      {
        code: 'CHPI_001', mycti1: 'https://slide.example.com/1',
        mycti2: JSON.stringify(videoUrls), mycti3: null,
        description: 'CUIE_001', myulc: 'ULC-001', myclag: 'CLAG-001', mytrigger: 'USI-TE001',
      },
    ]);

    const res = await request(app)
      .get('/api/video/by-session/CHPI_001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.chpiCode).toBe('CHPI_001');
    expect(res.body.data.cuieCode).toBe('CUIE_001');
    expect(res.body.data.slideLink).toBe('https://slide.example.com/1');
    expect(res.body.data.videos).toHaveLength(2);
    expect(res.body.data.videos[0]).toEqual({ url: 'https://video.example.com/1', name: 'Video 1' });
    expect(res.body.data.videos[1]).toEqual({ url: 'https://video.example.com/2', name: 'Video 2' });
    // Only 1 query (CHPI lookup), no VCR query needed
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('should fallback to VCR query when mycti2 is NULL → 200', async () => {
    // Query 1: CHPI lookup (mycti2 = null)
    mockQuery.mockResolvedValueOnce([
      {
        code: 'CHPI_002', mycti1: null, mycti2: null, mycti3: null,
        description: 'CUIE_002', myulc: 'ULC-001', myclag: 'CLAG-001', mytrigger: 'USI-TE001',
      },
    ]);
    // Query 2: VCR query on-demand
    mockQuery.mockResolvedValueOnce([
      { view_url: 'https://vcr.example.com/video1' },
      { view_url: 'https://vcr.example.com/video2' },
    ]);

    const res = await request(app)
      .get('/api/video/by-session/CHPI_002')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.videos).toHaveLength(2);
    expect(res.body.data.videos[0]).toEqual({ url: 'https://vcr.example.com/video1', name: 'Video 1' });
    expect(res.body.data.slideLink).toBeNull();
    // 2 queries: CHPI lookup + VCR
    expect(mockQuery).toHaveBeenCalledTimes(2);
    // Verify VCR query uses correct params
    const vcrSql = mockQuery.mock.calls[1][0] as string;
    expect(vcrSql).toContain('bp_usi_vcr_meeting');
    expect(vcrSql).toContain('bp_vcr_meeting');
  });

  it('should fallback to VCR query when mycti2 is invalid JSON → 200', async () => {
    // Query 1: CHPI lookup with non-JSON mycti2
    mockQuery.mockResolvedValueOnce([
      {
        code: 'CHPI_003', mycti1: null, mycti2: 'NOT-VALID-JSON', mycti3: null,
        description: 'CUIE_003', myulc: 'ULC-001', myclag: 'CLAG-001', mytrigger: 'USI-TE001',
      },
    ]);
    // Query 2: VCR fallback
    mockQuery.mockResolvedValueOnce([
      { view_url: 'https://vcr.example.com/video1' },
    ]);

    const res = await request(app)
      .get('/api/video/by-session/CHPI_003')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.videos).toHaveLength(1);
  });

  it('should return empty videos when CHPI has no myulc/mytrigger and mycti2 is NULL → 200', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        code: 'CHPI_EMPTY', mycti1: null, mycti2: null, mycti3: null,
        description: null, myulc: null, myclag: null, mytrigger: null,
      },
    ]);

    const res = await request(app)
      .get('/api/video/by-session/CHPI_EMPTY')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.videos).toHaveLength(0);
    expect(res.body.data.cuieCode).toBeNull();
    expect(res.body.data.slideLink).toBeNull();
  });

  it('should return 404 when CHPI not found', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/video/by-session/NONEXISTENT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ================================================================
// GET /api/video/by-cuie/:cuieCode
// ================================================================

describe('GET /api/video/by-cuie/:cuieCode', () => {
  it('should return CUIE event data with video links from VCR query → 200', async () => {
    // Query 1: CUIE lookup from bp_cuie_details
    mockQuery.mockResolvedValueOnce([
      { code: 'CUIE_001', name: 'Event 1', myusi: 'USI-TE001', trigger_at: '2026-01-15', myulc: 'ULC-001', myclag: 'CLAG-001' },
    ]);
    // Query 2: VCR video links
    mockQuery.mockResolvedValueOnce([
      { view_url: 'https://vcr.example.com/rec/v1' },
      { view_url: 'https://vcr.example.com/rec/v2' },
    ]);
    // Query 3: Teacher name
    mockQuery.mockResolvedValueOnce([
      { fullname: 'Nguyen Van A' },
    ]);

    const res = await request(app)
      .get('/api/video/by-cuie/CUIE_001')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cuieCode).toBe('CUIE_001');
    expect(res.body.data.teacher_name).toBe('Nguyen Van A');
    expect(res.body.data.videos).toHaveLength(2);
    expect(res.body.data.videos[0]).toEqual({ url: 'https://vcr.example.com/rec/v1', name: 'Video 1' });
    expect(res.body.data.videos[1]).toEqual({ url: 'https://vcr.example.com/rec/v2', name: 'Video 2' });
  });

  it('should return empty videos when cuie has no myulc → 200', async () => {
    mockQuery.mockResolvedValueOnce([
      { code: 'CUIE_NOVID', name: 'Event No Video', myusi: 'USI-TE003', trigger_at: '2026-01-20', myulc: null, myclag: null },
    ]);
    // VCR query returns empty (teacherCode exists but myulc is null → getVideosByVcr returns [])
    // Teacher name
    mockQuery.mockResolvedValueOnce([{ fullname: 'Le Van C' }]);

    const res = await request(app)
      .get('/api/video/by-cuie/CUIE_NOVID')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.videos).toHaveLength(0);
  });

  it('should query VCR with myusi + myulc from cuie_details', async () => {
    mockQuery.mockResolvedValueOnce([
      { code: 'CUIE_002', name: 'Event 2', myusi: 'USI-TE002', trigger_at: '2026-01-18', myulc: 'ULC-002', myclag: 'CLAG-002' },
    ]);
    // VCR query
    mockQuery.mockResolvedValueOnce([
      { view_url: 'https://vcr.example.com/rec/a' },
    ]);
    // Teacher name
    mockQuery.mockResolvedValueOnce([{ fullname: 'Tran Thi B' }]);

    await request(app)
      .get('/api/video/by-cuie/CUIE_002')
      .set('Authorization', `Bearer ${adminToken}`);

    // Verify VCR query was called with correct params
    const vcrSql = mockQuery.mock.calls[1][0] as string;
    expect(vcrSql).toContain('bp_usi_vcr_meeting');
    expect(vcrSql).toContain('bp_vcr_meeting');
    const vcrParams = mockQuery.mock.calls[1][1] as any[];
    expect(vcrParams).toEqual(['USI-TE002', 'ULC-002']);
  });

  it('should return 404 when CUIE event not found', async () => {
    mockQuery.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/video/by-cuie/NONEXISTENT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ================================================================
// Auth
// ================================================================

describe('Video endpoints — auth', () => {
  it('should return 401 for unauthenticated by-session request', async () => {
    const res = await request(app).get('/api/video/by-session/CHPI_001');
    expect(res.status).toBe(401);
  });

  it('should return 401 for unauthenticated by-cuie request', async () => {
    const res = await request(app).get('/api/video/by-cuie/CUIE_001');
    expect(res.status).toBe(401);
  });
});
