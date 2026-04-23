import { createLogger } from '@messageme/shared';
import { connectMongo, disconnectMongo } from './mongo';
import { disconnectRedis, getRedis } from './redis';
import { initProducer, disconnectProducer, startSentConsumer, stopConsumer } from './kafka';
import { startServer } from './grpc-server';
import { deliveryService } from './delivery.service';

const log = createLogger('delivery-service');

async function main() {
  await connectMongo();
  log.info('connected to mongodb');
  await getRedis().ping();
  log.info('connected to redis');
  await initProducer();
  await startServer();
  await startSentConsumer(async (event) => {
    try {
      await deliveryService.onMessageSent(event);
    } catch (err) {
      log.error({ err, eventId: event.event_id }, 'onMessageSent failed');
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
  await disconnectMongo().catch(() => void 0);
  await disconnectRedis().catch(() => void 0);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
