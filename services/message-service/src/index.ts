import { createLogger } from '@messageme/shared';
import { connectMongo, disconnectMongo } from './mongo';
import { initProducer, disconnectProducer } from './kafka';
import { startServer } from './grpc-server';

const log = createLogger('message-service');

async function main() {
  await connectMongo();
  log.info('connected to mongodb');
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
  await disconnectMongo().catch(() => void 0);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
