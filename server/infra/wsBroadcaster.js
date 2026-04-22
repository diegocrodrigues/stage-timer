/**
 * Infra: WsBroadcaster
 *
 * Manages all WebSocket client connections and exposes a broadcast function.
 * Isolated in infra so no other layer imports the 'ws' package directly.
 *
 * On each new connection, sends the current state immediately so the display
 * doesn't wait for the next tick to show something.
 *
 * @param {import('http').Server}  httpServer
 * @param {() => object}           getCurrentState  Called on new connection.
 * @returns {{ broadcast: (state: object) => void, connectedCount: () => number }}
 */
const { WebSocketServer, OPEN } = require('ws');
const logger = require('./logger');

function WsBroadcaster(httpServer, getCurrentState) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    logger.info({ clients: wss.clients.size }, 'ws client connected');
    ws.send(JSON.stringify(getCurrentState()));

    ws.on('close', () => {
      logger.info({ clients: wss.clients.size }, 'ws client disconnected');
    });
  });

  function broadcast(state) {
    const message = JSON.stringify(state);
    wss.clients.forEach(client => {
      if (client.readyState === OPEN) client.send(message);
    });
  }

  function connectedCount() {
    return wss.clients.size;
  }

  return { broadcast, connectedCount };
}

module.exports = WsBroadcaster;
