const express = require('express');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');

const app    = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── state ──────────────────────────────────────────────────────────────────

const STATE_FILE = path.join(__dirname, '../data/state.json');

const DEFAULT_STATE = {
  status: 'stopped',   // stopped | running | paused
  mode: 'countdown',   // countdown | countup
  totalSeconds: 0,
  remainingSeconds: 0,
};

let state      = { ...DEFAULT_STATE };
let tickTimer  = null;

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { ...DEFAULT_STATE, ...saved, status: 'stopped' };
  } catch {
    state = { ...DEFAULT_STATE };
  }
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* non-critical */ }
}

// ── timer logic ────────────────────────────────────────────────────────────

function tick() {
  if (state.mode === 'countdown') {
    state.remainingSeconds = Math.max(0, state.remainingSeconds - 1);
    if (state.remainingSeconds === 0) {
      clearInterval(tickTimer);
      tickTimer = null;
      state.status = 'stopped';
    }
  } else {
    state.remainingSeconds++;
  }
  saveState();
}

function startTick() {
  if (tickTimer) return;
  tickTimer = setInterval(tick, 1000);
}

function stopTick() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

// ── REST API ───────────────────────────────────────────────────────────────

app.get('/state', (_req, res) => res.json(state));

app.post('/command', (req, res) => {
  const { action, seconds } = req.body ?? {};

  switch (action) {

    case 'START':
      if (state.status === 'running') break;
      if (state.mode === 'countdown' && state.remainingSeconds <= 0)
        return res.status(400).json({ error: 'no time set' });
      state.status = 'running';
      startTick();
      break;

    case 'PAUSE':
      if (state.status !== 'running') break;
      state.status = 'paused';
      stopTick();
      break;

    case 'RESUME':
      if (state.status !== 'paused') break;
      state.status = 'running';
      startTick();
      break;

    case 'RESET':
      stopTick();
      state.remainingSeconds = state.totalSeconds;
      state.status = 'stopped';
      break;

    case 'SET_TIME': {
      if (typeof seconds !== 'number' || seconds < 0)
        return res.status(400).json({ error: 'invalid seconds' });
      stopTick();
      state.totalSeconds     = seconds;
      state.remainingSeconds = seconds;
      state.mode             = seconds > 0 ? 'countdown' : 'countup';
      state.status           = 'stopped';
      break;
    }

    default:
      return res.status(400).json({ error: `unknown action: ${action}` });
  }

  saveState();
  res.json(state);
});

// ── routes ─────────────────────────────────────────────────────────────────

app.get('/',        (_req, res) => res.redirect('/control'));
app.get('/display', (_req, res) => res.sendFile(path.join(__dirname, '../public/display.html')));
app.get('/control', (_req, res) => res.sendFile(path.join(__dirname, '../public/control.html')));

// ── start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

loadState();
server.listen(PORT, '0.0.0.0', () => {
  const ifaces = require('os').networkInterfaces();
  const ips = Object.values(ifaces).flat()
    .filter(i => i.family === 'IPv4' && !i.internal)
    .map(i => i.address);

  console.log(`\nStage Timer`);
  console.log(`  local   → http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  network → http://${ip}:${PORT}`));
  console.log(`  display → /display`);
  console.log(`  control → /control\n`);
});
