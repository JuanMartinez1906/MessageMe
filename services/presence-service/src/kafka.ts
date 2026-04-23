import { Kafka, Producer } from 'kafkajs';
import { createLogger, buildEnvelope, type EventEnvelope } from '@messageme/shared';
import { config } from './config';

const log = createLogger('presence-service:kafka');

let producer: Producer | null = null;

export async function initProducer(): Promise<void> {
  const kafka = new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers });
  producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  log.info({ brokers: config.kafkaBrokers }, 'kafka producer connected');
}

export type PresenceEvent = EventEnvelope<{
  user_id: string;
  online: boolean;
  last_seen: string | null;
  at: string;
}>;

// Topic `user.presence` is compacted by `user_id`, so only the latest state is retained.
export async function publishPresence(args: {
  userId: string;
  online: boolean;
  lastSeen: string | null;
}): Promise<void> {
  if (!producer) throw new Error('Kafka producer not initialized');
  const now = new Date().toISOString();
  const event = buildEnvelope({
    topic: 'user.presence',
    producer: 'presence-service',
    payload: {
      user_id: args.userId,
      online: args.online,
      last_seen: args.lastSeen,
      at: now,
    },
  });
  await producer.send({
    topic: 'user.presence',
    messages: [
      {
        key: args.userId,
        value: JSON.stringify(event),
        headers: { 'event-type': 'user.presence' },
      },
    ],
  });
}

export async function disconnectProducer(): Promise<void> {
  await producer?.disconnect();
  producer = null;
}
