import { createLogger } from '@messageme/shared';
import { prisma, disconnectPrisma } from './prisma';
import {
  initProducer,
  disconnectProducer,
  startMediaReadyConsumer,
  stopConsumer,
} from './kafka';
import { startServer } from './grpc-server';
import { fileService } from './file.service';

const log = createLogger('file-service');

async function main() {
  await prisma.$connect();
  log.info('connected to postgres');
  await initProducer();
  await startServer();
  await startMediaReadyConsumer(async (event) => {
    try {
      await fileService.applyMediaReady(event);
    } catch (err) {
      log.error({ err, eventId: event.event_id }, 'applyMediaReady failed');
    }
  });
}

main().catch((err) => {
  log.error({ err }, 'fatal startup error');
  process.exit(1);
});

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down');
  await stopConsumer().catch(() => void 0);
  await disconnectProducer().catch(() => void 0);
  await disconnectPrisma().catch(() => void 0);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
