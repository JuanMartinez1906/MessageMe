import { Kafka, Producer, Consumer } from 'kafkajs';
import {
  createLogger,
  buildEnvelope,
  parseEnvelope,
  EnvelopeValidationError,
  type EventEnvelope,
} from '@messageme/shared';
import { config } from './config';

const log = createLogger('delivery-service:kafka');

let producer: Producer | null = null;
let consumer: Consumer | null = null;

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

export type MessageSentEvent = EventEnvelope<MessageSentPayload>;

export type DeliveredPayload = {
  message_id: string;
  user_id: string;
  sender_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  delivered_at: string;
};

export type ReadPayload = {
  message_id: string;
  user_id: string;
  sender_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  read_at: string;
};

export async function initProducer(): Promise<void> {
  const kafka = new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers });
  producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  log.info({ brokers: config.kafkaBrokers }, 'kafka producer connected');
}

export async function publishDelivered(args: {
  messageId: string;
  userId: string;
  senderId: string;
  channelId: string | null;
  conversationId: string | null;
  deliveredAt: Date;
}): Promise<void> {
  if (!producer) throw new Error('Kafka producer not initialized');
  const event = buildEnvelope({
    topic: 'messages.delivered',
    producer: 'delivery-service',
    payload: {
      message_id: args.messageId,
      user_id: args.userId,
      sender_id: args.senderId,
      channel_id: args.channelId,
      conversation_id: args.conversationId,
      delivered_at: args.deliveredAt.toISOString(),
    },
  });
  await producer.send({
    topic: 'messages.delivered',
    messages: [
      {
        key: args.senderId,
        value: JSON.stringify(event),
        headers: { 'event-type': 'messages.delivered' },
      },
    ],
  });
}

export async function publishRead(args: {
  messageId: string;
  userId: string;
  senderId: string;
  channelId: string | null;
  conversationId: string | null;
  readAt: Date;
}): Promise<void> {
  if (!producer) throw new Error('Kafka producer not initialized');
  const event = buildEnvelope({
    topic: 'messages.read',
    producer: 'delivery-service',
    payload: {
      message_id: args.messageId,
      user_id: args.userId,
      sender_id: args.senderId,
      channel_id: args.channelId,
      conversation_id: args.conversationId,
      read_at: args.readAt.toISOString(),
    },
  });
  await producer.send({
    topic: 'messages.read',
    messages: [
      {
        key: args.senderId,
        value: JSON.stringify(event),
        headers: { 'event-type': 'messages.read' },
      },
    ],
  });
}

export async function startSentConsumer(
  onMessageSent: (event: MessageSentEvent) => Promise<void>
): Promise<void> {
  const kafka = new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers });
  consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  await consumer.connect();
  await consumer.subscribe({ topic: 'messages.sent', fromBeginning: false });
  log.info({ topic: 'messages.sent', groupId: config.kafkaGroupId }, 'kafka consumer subscribed');

  await consumer.run({
    eachMessage: async ({ message, topic }) => {
      if (!message.value) return;
      try {
        const event = parseEnvelope<MessageSentPayload>('messages.sent', message.value);
        await onMessageSent(event);
      } catch (err) {
        if (err instanceof EnvelopeValidationError) {
          log.warn({ err: err.message, topic }, 'dropping invalid event');
        } else {
          log.error({ err, topic }, 'failed to handle kafka message');
        }
      }
    },
  });
}

export async function disconnectProducer(): Promise<void> {
  await producer?.disconnect();
  producer = null;
}
export async function stopConsumer(): Promise<void> {
  await consumer?.disconnect();
  consumer = null;
}
