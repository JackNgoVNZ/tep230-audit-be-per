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

let token: string;

beforeAll(() => {
  token = makeToken('AD');
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe('CHPT CRUD', () => {
  it('POST /api/settings/chpt creates template', async () => {
    mockQuery.mockResolvedValueOnce([]); // dup check
    mockQuery.mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]); // hasMyptMygg check
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // insert

    const res = await request(app)
      .post('/api/settings/chpt')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'PT1-GG1-LCK1', name: 'Test Template' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('code', 'PT1-GG1-LCK1');
  });

  it('PUT /api/settings/chpt/:code updates', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-LCK1' }]); // exists
    mockQuery.mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]); // hasMyptMygg check
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // update

    const res = await request(app)
      .put('/api/settings/chpt/PT1-GG1-LCK1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Template' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('updated', true);
  });

  it('PATCH /api/settings/chpt/:code/unpublish sets published=0', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-LCK1' }]); // exists
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // update

    const res = await request(app)
      .patch('/api/settings/chpt/PT1-GG1-LCK1/unpublish')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('published', 0);
  });

  it('PATCH /api/settings/chpt/:code/publish sets published=1', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-LCK1' }]); // exists
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // update

    const res = await request(app)
      .patch('/api/settings/chpt/PT1-GG1-LCK1/publish')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('published', 1);
  });

  it('GET /api/settings/chpt?mypt=X filters correctly', async () => {
    mockQuery.mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]); // hasMyptMygg check
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-LCK1', name: 'T1', mypt: 'PT1', mygg: 'GG1' }]); // data
    mockQuery.mockResolvedValueOnce([{ total: 1 }]); // count

    const res = await request(app)
      .get('/api/settings/chpt?mypt=PT1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toContain('mypt = ?');
  });

  it('GET /api/settings/chpt?published=yes filters published rows', async () => {
    mockQuery.mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]); // hasMyptMygg check
    mockQuery.mockResolvedValueOnce([{ code: 'PT1-GG1-LCK1', name: 'T1', published: 1 }]); // data
    mockQuery.mockResolvedValueOnce([{ total: 1 }]); // count

    const res = await request(app)
      .get('/api/settings/chpt?published=yes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const sql = mockQuery.mock.calls[1][0] as string;
    expect(sql).toContain('published + 0 = 1');
  });
});

describe('Batch CHPT', () => {
  it('GET /api/settings/chpt/existing/:pt returns existing combos', async () => {
    mockQuery.mockResolvedValueOnce([
      { code: 'LCP1-LCET1-BC-G3', mygg: 'G3', mylcp: 'LCP1', mylcet: 'LCET1' },
    ]);

    const res = await request(app)
      .get('/api/settings/chpt/existing/BC')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('mylcp', 'LCP1');
  });

  it('POST /api/settings/chpt/batch creates multiple CHPTs', async () => {
    // 1. LCET name lookup
    mockQuery.mockResolvedValueOnce([{ code: 'AF-FL-AAL', name: 'AuditAudioLater' }]);
    // 2. Existing combos for PT=BC
    mockQuery.mockResolvedValueOnce([]);
    // 3. Code dup check
    mockQuery.mockResolvedValueOnce([]);
    // 4. Batch INSERT
    mockQuery.mockResolvedValueOnce({ affectedRows: 2 });

    const res = await request(app)
      .post('/api/settings/chpt/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ pt: 'BC', gg: ['G3', 'G5'], lcp: ['LCP1'], lcet: ['AF-FL-AAL'] });

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.codes).toHaveLength(2);
  });

  it('POST /api/settings/chpt/batch skips existing combos', async () => {
    // 1. LCET name lookup
    mockQuery.mockResolvedValueOnce([{ code: 'AF-FL-AAL', name: 'AuditAudioLater' }]);
    // 2. Existing combos: LCP1+AF-FL-AAL+G3 already exists
    mockQuery.mockResolvedValueOnce([{ mylcp: 'LCP1', mylcet: 'AF-FL-AAL', mygg: 'G3' }]);
    // 3. Code dup check (only G5 combo remains)
    mockQuery.mockResolvedValueOnce([]);
    // 4. Batch INSERT
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .post('/api/settings/chpt/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ pt: 'BC', gg: ['G3', 'G5'], lcp: ['LCP1'], lcet: ['AF-FL-AAL'] });

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(1);
  });

  it('POST /api/settings/chpt/batch returns 0 when all exist', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'AF-FL-AAL', name: 'AuditAudioLater' }]);
    mockQuery.mockResolvedValueOnce([{ mylcp: 'LCP1', mylcet: 'AF-FL-AAL', mygg: 'G3' }]);

    const res = await request(app)
      .post('/api/settings/chpt/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ pt: 'BC', gg: ['G3'], lcp: ['LCP1'], lcet: ['AF-FL-AAL'] });

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(0);
  });

  it('POST /api/settings/chpt/batch validates input', async () => {
    const res = await request(app)
      .post('/api/settings/chpt/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ pt: '', gg: [], lcp: ['X'], lcet: ['Y'] });

    expect(res.status).toBe(400);
  });
});

describe('CHST CRUD', () => {
  it('POST /api/settings/chst creates step template', async () => {
    mockQuery.mockResolvedValueOnce([]); // dup check
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // insert

    const res = await request(app)
      .post('/api/settings/chst')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'CHST-001', name: 'Step 1', mychpt: 'PT1-GG1-LCK1' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('code', 'CHST-001');
  });

  it('PUT /api/settings/chst/:code updates', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'CHST-001' }]);
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .put('/api/settings/chst/CHST-001')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Step' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('updated', true);
  });

  it('PATCH /api/settings/chst/:code/unpublish works', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'CHST-001' }]);
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .patch('/api/settings/chst/CHST-001/unpublish')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('published', 0);
  });
});

describe('CHLT CRUD', () => {
  it('POST /api/settings/chlt creates checklist template', async () => {
    mockQuery.mockResolvedValueOnce([]); // dup check
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 }); // insert

    const res = await request(app)
      .post('/api/settings/chlt')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'CHLT-001', name: 'Criterion 1', mychst: 'CHST-001' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('code', 'CHLT-001');
  });

  it('PUT /api/settings/chlt/:code updates', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'CHLT-001' }]);
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .put('/api/settings/chlt/CHLT-001')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Criterion' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('updated', true);
  });

  it('PATCH /api/settings/chlt/:code/unpublish works', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'CHLT-001' }]);
    mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

    const res = await request(app)
      .patch('/api/settings/chlt/CHLT-001/unpublish')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('published', 0);
  });
});

describe('GET /api/settings/chpt/filter-options', () => {
  it('returns PT, GG, LCP, LCET options as {code,name}', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'DLC', name: 'DLC Product' }, { code: 'ENG', name: 'English' }]); // pt
    mockQuery.mockResolvedValueOnce([{ code: '75MI', name: '75 Minutes' }, { code: '40MI', name: '40 Minutes' }]); // gg
    mockQuery.mockResolvedValueOnce([{ code: 'CS', name: 'CS Period' }]); // lcp
    mockQuery.mockResolvedValueOnce([{ code: 'AF-FL', name: 'Flashcard' }]); // lcet

    const res = await request(app)
      .get('/api/settings/chpt/filter-options')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pt).toEqual([
      { code: 'DLC', name: 'DLC Product' },
      { code: 'ENG', name: 'English' },
    ]);
    expect(res.body.data.gg).toEqual([
      { code: '75MI', name: '75 Minutes' },
      { code: '40MI', name: '40 Minutes' },
    ]);
    expect(res.body.data.lcp).toEqual([{ code: 'CS', name: 'CS Period' }]);
    expect(res.body.data.lcet).toEqual([{ code: 'AF-FL', name: 'Flashcard' }]);
  });

  it('QS can access filter-options (200)', async () => {
    const qsToken = makeToken('QS');
    mockQuery.mockResolvedValueOnce([]); // pt
    mockQuery.mockResolvedValueOnce([]); // gg
    mockQuery.mockResolvedValueOnce([]); // lcp
    mockQuery.mockResolvedValueOnce([]); // lcet

    const res = await request(app)
      .get('/api/settings/chpt/filter-options')
      .set('Authorization', `Bearer ${qsToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('pt');
    expect(res.body.data).toHaveProperty('gg');
    expect(res.body.data).toHaveProperty('lcp');
    expect(res.body.data).toHaveProperty('lcet');
  });
});

describe('Role-based access for settings', () => {
  it('QS cannot create CHPT (403)', async () => {
    const qsToken = makeToken('QS');
    const res = await request(app)
      .post('/api/settings/chpt')
      .set('Authorization', `Bearer ${qsToken}`)
      .send({ code: 'X', name: 'Y' });

    expect(res.status).toBe(403);
  });

  it('QS can read CHPT (200)', async () => {
    const qsToken = makeToken('QS');
    mockQuery.mockResolvedValueOnce([{ COLUMN_NAME: 'mypt' }]); // hasMyptMygg check
    mockQuery.mockResolvedValueOnce([]); // data
    mockQuery.mockResolvedValueOnce([{ total: 0 }]); // count

    const res = await request(app)
      .get('/api/settings/chpt')
      .set('Authorization', `Bearer ${qsToken}`);

    expect(res.status).toBe(200);
  });
});
