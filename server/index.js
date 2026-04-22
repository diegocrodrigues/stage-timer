/**
 * Bootstrap
 *
 * Wires dependencies and starts the HTTP server.
 * This is the only file that knows about ports, OS interfaces,
 * and the concrete persistence implementation.
 */
const http                  = require('http');
const os                    = require('os');
const createApp             = require('./app');
const TimerService          = require('./usecases/timerService');
const fileStatePersistence  = require('./infra/fileStatePersistence');

const timerService = TimerService(fileStatePersistence);
const server       = http.createServer(createApp(timerService));

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
