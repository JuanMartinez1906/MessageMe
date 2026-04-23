import http from 'http';
import { Server as IOServer } from 'socket.io';
import { createLogger } from '@messageme/shared';
import { config } from './config';
import { Gateway } from './gateway';
import { startConsumers, stopConsumers } from './kafka-consumer';

const log = createLogger('ws-gateway');

async function main() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const io = new IOServer(server, {
    cors: { origin: config.corsOrigin, credentials: true },
  });
  const gateway = new Gateway(io);
  server.listen(config.port, () => log.info({ port: config.port }, 'ws-gateway listening'));

  await startConsumers({
    onMessageSent: async (e) => gateway.handleMessageSent(e),
    onMessageDelivered: async (e) => gateway.handleMessageDelivered(e),
    onMessageRead: async (e) => gateway.handleMessageRead(e),
    onUserPresence: async (e) => gateway.handleUserPresence(e),
    onMediaReady: async (e) => gateway.handleMediaReady(e),
  });
}

main().catch((err) => {
  log.error({ err }, 'fatal startup error');
  process.exit(1);
});

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down');
  await stopConsumers().catch(() => void 0);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
