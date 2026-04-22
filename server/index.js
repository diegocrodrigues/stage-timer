/**
 * Bootstrap
 *
 * Wires all dependencies and starts the HTTP + WebSocket server.
 * This is the only file that knows about ports, OS interfaces,
 * and concrete infrastructure implementations.
 *
 * Dependency order:
 *   broadcaster declared → timerService created (captures broadcaster ref) →
 *   broadcaster instantiated → both ready before any client connects.
 */
const http                 = require('http');
const os                   = require('os');
const createApp            = require('./app');
const TimerService         = require('./usecases/timerService');
const fileStatePersistence = require('./infra/fileStatePersistence');
const WsBroadcaster        = require('./infra/wsBroadcaster');

// Broadcaster is assigned after server creation; the ref is captured by the
// closure so onStateChange calls broadcaster.broadcast only after it exists.
let broadcaster;

const timerService = TimerService(fileStatePersistence, state => broadcaster.broadcast(state));
const server       = http.createServer(createApp(timerService));

broadcaster = WsBroadcaster(server, () => timerService.getState());

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  const networkIPs = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i.family === 'IPv4' && !i.internal)
    .map(i => i.address);

  console.log('\nStage Timer');
  console.log(`  local   → http://localhost:${PORT}`);
  networkIPs.forEach(ip => console.log(`  network → http://${ip}:${PORT}`));
  console.log('  display → /display');
  console.log('  control → /control\n');
});
