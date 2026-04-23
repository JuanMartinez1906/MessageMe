import { randomUUID } from 'crypto';
import { Kafka, Consumer } from 'kafkajs';
import {
  createLogger,
  parseEnvelope,
  EnvelopeValidationError,
  type EventEnvelope,
} from '@messageme/shared';
import { config } from './config';

const log = createLogger('ws-gateway:kafka');

export type MessageSentPayload = {
  message_id: string;
  sender_id: string;
  type: string;
  content?: string;
  file_id?: string | null;
  channel_id: string | null;
  conversation_id: string | null;
  recipient_ids?: string[];
  created_at: string;
};

export type MessageDeliveredPayload = {
  message_id: string;
  user_id: string;
  sender_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  delivered_at: string;
};

export type MessageReadPayload = {
  message_id: string;
  user_id: string;
  sender_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  read_at: string;
};

export type UserPresencePayload = {
  user_id: string;
  online: boolean;
  last_seen: string | null;
  at: string;
};

export type MediaReadyPayload = {
  file_id: string;
  status: 'READY' | 'FAILED';
  thumbnail_key: string | null;
  width: number | null;
  height: number | null;
  error: string | null;
  processed_at: string;
};

export type MessageSentEvent = EventEnvelope<MessageSentPayload>;
export type MessageDeliveredEvent = EventEnvelope<MessageDeliveredPayload>;
export type MessageReadEvent = EventEnvelope<MessageReadPayload>;
export type UserPresenceEvent = EventEnvelope<UserPresencePayload>;
export type MediaReadyEvent = EventEnvelope<MediaReadyPayload>;

export interface ConsumerHandlers {
  onMessageSent: (event: MessageSentEvent) => Promise<void>;
  onMessageDelivered: (event: MessageDeliveredEvent) => Promise<void>;
  onMessageRead: (event: MessageReadEvent) => Promise<void>;
  onUserPresence: (event: UserPresenceEvent) => Promise<void>;
  onMediaReady: (event: MediaReadyEvent) => Promise<void>;
}

const consumers: Consumer[] = [];

// Every ws-gateway replica needs to see every event so it can push to the users it holds
// sockets for. We achieve that by giving each replica a unique suffix on the consumer
// group id (random uuid per process) — that way each replica is in its own group and
// each topic partition is delivered to every replica.
function uniqueGroupId(base: string): string {
  return `${base}-${randomUUID()}`;
}

async function makeConsumer<P>(
  baseGroupId: string,
  topic: string,
  handler: (event: EventEnvelope<P>) => Promise<void>
) {
  const kafka = new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers });
  const groupId = uniqueGroupId(baseGroupId);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  log.info({ topic, groupId }, 'kafka consumer subscribed');
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const event = parseEnvelope<P>(topic, message.value);
        await handler(event);
      } catch (err) {
        if (err instanceof EnvelopeValidationError) {
          log.warn({ err: err.message, topic }, 'dropping invalid event');
        } else {
          log.error({ err, topic }, 'failed to handle kafka message');
        }
      }
    },
  });
  consumers.push(consumer);
}

export async function startConsumers(h: ConsumerHandlers): Promise<void> {
  await Promise.all([
    makeConsumer<MessageSentPayload>(config.kafkaGroupIdSent, 'messages.sent', h.onMessageSent),
    makeConsumer<MessageDeliveredPayload>(
      config.kafkaGroupIdDelivered,
      'messages.delivered',
      h.onMessageDelivered
    ),
    makeConsumer<MessageReadPayload>(config.kafkaGroupIdRead, 'messages.read', h.onMessageRead),
    makeConsumer<UserPresencePayload>(config.kafkaGroupIdPresence, 'user.presence', h.onUserPresence),
    makeConsumer<MediaReadyPayload>(config.kafkaGroupIdMediaReady, 'media.ready', h.onMediaReady),
  ]);
}

export async function stopConsumers(): Promise<void> {
  await Promise.all(consumers.map((c) => c.disconnect().catch(() => void 0)));
  consumers.length = 0;
}
