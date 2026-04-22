/**
 * Bootstrap
 *
 * Wires all dependencies and starts the HTTP + WebSocket server.
 * This is the only file that knows about ports, OS interfaces,
 * and concrete infrastructure implementations.
 */
const http                 = require('http');
const os                   = require('os');
const createApp            = require('./app');
const TimerService         = require('./usecases/timerService');
const fileStatePersistence = require('./infra/fileStatePersistence');
const WsBroadcaster        = require('./infra/wsBroadcaster');
const logger               = require('./infra/logger');

let broadcaster;

const timerService = TimerService(fileStatePersistence, state => broadcaster?.broadcast(state));
const server       = http.createServer(createApp(timerService, () => broadcaster?.connectedCount() ?? 0));

broadcaster = WsBroadcaster(server, () => timerService.getState());

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  const networkIPs = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i.family === 'IPv4' && !i.internal)
    .map(i => i.address);

  logger.info({ port: PORT, network: networkIPs }, 'Stage Timer started');
  logger.info(`  local   → http://localhost:${PORT}/control`);
  networkIPs.forEach(ip => logger.info(`  network → http://${ip}:${PORT}/control`));
});
