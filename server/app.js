/**
 * App factory
 *
 * Creates and configures the Express application.
 * Separate from index.js so the app can be imported in tests
 * without binding to a port.
 *
 * @param {ReturnType<import('./usecases/timerService')>} timerService
 * @param {() => number} getConnectionCount  Returns current WS client count.
 * @returns {import('express').Application}
 */
const express     = require('express');
const path        = require('path');
const timerRouter = require('./routes/timerRouter');

const PUBLIC_DIR = path.join(__dirname, '../public');

function createApp(timerService, getConnectionCount = () => 0) {
  const app = express();

  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));
  app.use('/', timerRouter(timerService));

  app.get('/health', (_req, res) => {
    const { status, remainingSeconds } = timerService.getState();
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      wsConnections: getConnectionCount(),
      timer: { status, remainingSeconds },
    });
  });

  app.get('/',        (_req, res) => res.redirect('/control'));
  app.get('/display', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'display.html')));
  app.get('/control', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'control.html')));

  return app;
}

module.exports = createApp;
