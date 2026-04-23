import { Kafka, Producer, Consumer } from 'kafkajs';
import {
  createLogger,
  buildEnvelope,
  parseEnvelope,
  EnvelopeValidationError,
  type EventEnvelope,
} from '@messageme/shared';
import { config } from './config';

const log = createLogger('file-service:kafka');

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

export async function publishFileUploaded(args: {
  fileId: string;
  ownerId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  uploadedAt: Date;
}): Promise<void> {
  if (!producer) throw new Error('Kafka producer not initialized');
  const event = buildEnvelope({
    topic: 'files.uploaded',
    producer: 'file-service',
    payload: {
      file_id: args.fileId,
      owner_id: args.ownerId,
      storage_key: args.storageKey,
      mime_type: args.mimeType,
      size_bytes: args.sizeBytes,
      original_name: args.originalName,
      uploaded_at: args.uploadedAt.toISOString(),
    },
  });
  await producer.send({
    topic: 'files.uploaded',
    messages: [
      {
        key: args.fileId,
        value: JSON.stringify(event),
        headers: { 'event-type': 'files.uploaded' },
      },
    ],
  });
}

// Consumes media.ready so file-service can update the DB status/thumbnail.
export async function startMediaReadyConsumer(
  onMediaReady: (event: MediaReadyEvent) => Promise<void>
): Promise<void> {
  const kafka = new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers });
  consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  await consumer.connect();
  await consumer.subscribe({ topic: 'media.ready', fromBeginning: false });
  log.info({ topic: 'media.ready', groupId: config.kafkaGroupId }, 'kafka consumer subscribed');

  await consumer.run({
    eachMessage: async ({ message, topic }) => {
      if (!message.value) return;
      try {
        const event = parseEnvelope<MediaReadyPayload>('media.ready', message.value);
        await onMediaReady(event);
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
