import { Kafka, Producer, Consumer } from 'kafkajs';
import {
  createLogger,
  buildEnvelope,
  parseEnvelope,
  EnvelopeValidationError,
  type EventEnvelope,
} from '@messageme/shared';
import { config } from './config';

const log = createLogger('media-processor:kafka');

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export type FileUploadedPayload = {
  file_id: string;
  owner_id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  original_name?: string;
  uploaded_at: string;
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

export type FileUploadedEvent = EventEnvelope<FileUploadedPayload>;
export type MediaReadyEvent = EventEnvelope<MediaReadyPayload>;

export async function initProducer(): Promise<void> {
  const kafka = new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers });
  producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  log.info({ brokers: config.kafkaBrokers }, 'kafka producer connected');
}

export async function publishMediaReady(args: {
  fileId: string;
  status: 'READY' | 'FAILED';
  thumbnailKey: string | null;
  width: number | null;
  height: number | null;
  error: string | null;
}): Promise<void> {
  if (!producer) throw new Error('Kafka producer not initialized');
  const event = buildEnvelope({
    topic: 'media.ready',
    producer: 'media-processor',
    payload: {
      file_id: args.fileId,
      status: args.status,
      thumbnail_key: args.thumbnailKey,
      width: args.width,
      height: args.height,
      error: args.error,
      processed_at: new Date().toISOString(),
    },
  });
  await producer.send({
    topic: 'media.ready',
    messages: [
      {
        key: args.fileId,
        value: JSON.stringify(event),
        headers: { 'event-type': 'media.ready' },
      },
    ],
  });
}

export async function startFileUploadedConsumer(
  onFileUploaded: (event: FileUploadedEvent) => Promise<void>
): Promise<void> {
  const kafka = new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers });
  consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  await consumer.connect();
  await consumer.subscribe({ topic: 'files.uploaded', fromBeginning: false });
  log.info({ topic: 'files.uploaded', groupId: config.kafkaGroupId }, 'kafka consumer subscribed');

  await consumer.run({
    eachMessage: async ({ message, topic }) => {
      if (!message.value) return;
      try {
        const event = parseEnvelope<FileUploadedPayload>('files.uploaded', message.value);
        await onFileUploaded(event);
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
