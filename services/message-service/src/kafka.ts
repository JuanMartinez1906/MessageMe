import { Kafka, Producer } from 'kafkajs';
import { createLogger, buildEnvelope, type EventEnvelope } from '@messageme/shared';
import { config } from './config';

const log = createLogger('message-service:kafka');

let producer: Producer | null = null;

export async function initProducer(): Promise<void> {
  const kafka = new Kafka({
    clientId: config.kafkaClientId,
    brokers: config.kafkaBrokers,
  });
  producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  log.info({ brokers: config.kafkaBrokers }, 'kafka producer connected');
}

export type MessageSentPayload = {
  message_id: string;
  sender_id: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';
  content?: string;
  file_id?: string | null;
  channel_id: string | null;
  conversation_id: string | null;
  recipient_ids?: string[];
  created_at: string;
};

export type MessageSentEvent = EventEnvelope<MessageSentPayload>;

export async function publishMessageSent(
  payload: MessageSentPayload,
  partitionKey: string
): Promise<void> {
  if (!producer) throw new Error('Kafka producer not initialized');
  const event = buildEnvelope({
    topic: 'messages.sent',
    producer: 'message-service',
    payload,
  });
  await producer.send({
    topic: 'messages.sent',
    messages: [
      {
        key: partitionKey,
        value: JSON.stringify(event),
        headers: { 'event-type': 'messages.sent' },
      },
    ],
  });
}

export async function disconnectProducer(): Promise<void> {
  await producer?.disconnect();
  producer = null;
}
