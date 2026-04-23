import { createLogger } from '@messageme/shared';
import { disconnectRedis, getRedis } from './redis';
import { initProducer, disconnectProducer } from './kafka';
import { startServer } from './grpc-server';

const log = createLogger('presence-service');

async function main() {
  // Connect to Redis eagerly so any config problem fails startup loudly.
  await getRedis().ping();
  log.info('connected to redis');
  await initProducer();
  await startServer();
}

main().catch((err) => {
  log.error({ err }, 'fatal startup error');
  process.exit(1);
});

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down');
  await disconnectProducer().catch(() => void 0);
  await disconnectRedis().catch(() => void 0);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
