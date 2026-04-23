import { createLogger } from '@messageme/shared';
import { prisma } from './prisma';
import { startServer } from './grpc-server';

const log = createLogger('user-service');

async function main() {
  await prisma.$connect();
  log.info('connected to postgres');
  await startServer();
}

main().catch((err) => {
  log.error({ err }, 'fatal startup error');
  process.exit(1);
});

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down');
  await prisma.$disconnect().catch(() => void 0);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
