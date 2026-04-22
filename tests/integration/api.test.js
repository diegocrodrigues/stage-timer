const request    = require('supertest');
const createApp  = require('../../server/app');
const TimerService = require('../../server/usecases/timerService');

const memPersistence = { load: (d) => ({ ...d }), save: () => {} };

let app;

beforeEach(() => {
  // Fresh service per test — no state bleed between cases
  const svc = TimerService(memPersistence);
  app = createApp(svc);
});

describe('GET /state', () => {
  it('returns 200 with correct shape', async () => {
    const res = await request(app).get('/state');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: expect.any(String),
      mode: expect.any(String),
      totalSeconds: expect.any(Number),
      remainingSeconds: expect.any(Number),
    });
  });
});

describe('GET /health', () => {
  it('returns 200 with uptime and timer fields', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      uptime: expect.any(Number),
      wsConnections: expect.any(Number),
      timer: { status: expect.any(String), remainingSeconds: expect.any(Number) },
    });
  });
});

describe('POST /command', () => {
  it('SET_TIME → returns updated state', async () => {
    const res = await request(app)
      .post('/command')
      .send({ action: 'SET_TIME', seconds: 120 });
    expect(res.status).toBe(200);
    expect(res.body.totalSeconds).toBe(120);
    expect(res.body.remainingSeconds).toBe(120);
    expect(res.body.mode).toBe('countdown');
  });

  it('SET_TIME + START → status running', async () => {
    await request(app).post('/command').send({ action: 'SET_TIME', seconds: 60 });
    const res = await request(app).post('/command').send({ action: 'START' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
  });

  it('unknown action → 400 with error', async () => {
    const res = await request(app).post('/command').send({ action: 'EXPLODE' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown action/);
  });

  it('START without time → 400', async () => {
    const res = await request(app).post('/command').send({ action: 'START' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no time set/);
  });

  it('SET_TIME with invalid seconds → 400', async () => {
    const res = await request(app).post('/command').send({ action: 'SET_TIME', seconds: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid seconds/);
  });

  it('full cycle: SET_TIME → START → PAUSE → RESUME → RESET', async () => {
    const post = (body) => request(app).post('/command').send(body);

    await post({ action: 'SET_TIME', seconds: 60 });
    expect((await post({ action: 'START' })).body.status).toBe('running');
    expect((await post({ action: 'PAUSE' })).body.status).toBe('paused');
    expect((await post({ action: 'RESUME' })).body.status).toBe('running');
    const reset = await post({ action: 'RESET' });
    expect(reset.body.status).toBe('stopped');
    expect(reset.body.remainingSeconds).toBe(60);
  });
});
