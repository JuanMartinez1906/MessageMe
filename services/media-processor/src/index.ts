import { createLogger } from '@messageme/shared';
import {
  initProducer,
  disconnectProducer,
  startFileUploadedConsumer,
  stopConsumer,
} from './kafka';
import { processFileUploaded } from './processor';

const log = createLogger('media-processor');

async function main() {
  await initProducer();
  await startFileUploadedConsumer(async (event) => {
    await processFileUploaded(event);
  });
  log.info('media-processor ready');
}

main().catch((err) => {
  log.error({ err }, 'fatal startup error');
  process.exit(1);
});

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down');
  await stopConsumer().catch(() => void 0);
  await disconnectProducer().catch(() => void 0);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
