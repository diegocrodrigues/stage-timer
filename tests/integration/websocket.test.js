const http          = require('http');
const WebSocket     = require('ws');
const createApp     = require('../../server/app');
const TimerService  = require('../../server/usecases/timerService');
const WsBroadcaster = require('../../server/infra/wsBroadcaster');
const request       = require('supertest');

const memPersistence = { load: (d) => ({ ...d }), save: () => {} };

let server, timerService, port;

const wsUrl = () => `ws://localhost:${port}`;

/**
 * Creates a WebSocket with a buffered message queue.
 * Messages are captured immediately on creation (before 'open'), so the
 * initial state sent by the server on connect is never missed.
 */
const connectWs = () => new Promise((resolve, reject) => {
  const ws       = new WebSocket(wsUrl());
  const pending  = [];
  const waiters  = [];

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (waiters.length) waiters.shift()(msg);
    else pending.push(msg);
  });

  ws.nextMessage = () => new Promise((res) => {
    if (pending.length) res(pending.shift());
    else waiters.push(res);
  });

  ws.once('open',  () => resolve(ws));
  ws.once('error', reject);
});

beforeAll((done) => {
  let broadcaster;
  timerService = TimerService(memPersistence, state => broadcaster?.broadcast(state));
  const app = createApp(timerService, () => broadcaster?.connectedCount() ?? 0);
  server      = http.createServer(app);
  broadcaster = WsBroadcaster(server, () => timerService.getState());
  server.listen(0, () => { port = server.address().port; done(); });
});

afterAll((done) => { server.close(done); });

describe('WebSocket — on connect', () => {
  it('receives current state immediately on connect', async () => {
    const ws    = await connectWs();
    const state = await ws.nextMessage();
    expect(state).toMatchObject({
      status: expect.any(String),
      remainingSeconds: expect.any(Number),
    });
    ws.close();
  });
});

describe('WebSocket — broadcast after command', () => {
  it('receives broadcast when START is sent via REST', async () => {
    await request(server).post('/command').send({ action: 'SET_TIME', seconds: 30 });

    const ws = await connectWs();
    await ws.nextMessage(); // discard initial state

    const broadcastPromise = ws.nextMessage();
    await request(server).post('/command').send({ action: 'START' });
    const broadcasted = await broadcastPromise;

    expect(broadcasted.status).toBe('running');
    ws.close();
  });

  it('two clients receive the same broadcast simultaneously', async () => {
    await request(server).post('/command').send({ action: 'SET_TIME', seconds: 30 });

    const ws1 = await connectWs();
    const ws2 = await connectWs();
    await ws1.nextMessage(); // discard initial
    await ws2.nextMessage(); // discard initial

    const [msg1, msg2] = await Promise.all([
      ws1.nextMessage(),
      ws2.nextMessage(),
      request(server).post('/command').send({ action: 'START' }),
    ]);

    expect(msg1.status).toBe('running');
    expect(msg2.status).toBe('running');
    ws1.close();
    ws2.close();
  });
});
