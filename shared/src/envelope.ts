import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const DEFAULT_EVENTS_DIR = path.resolve(__dirname, '../../events');

export interface EventEnvelope<P = unknown> {
  event_id: string;
  event_type: string;
  event_version: number;
  occurred_at: string;
  producer: string;
  trace_id?: string;
  payload: P;
}

export interface BuildEnvelopeArgs<P> {
  topic: string;
  producer: string;
  payload: P;
  traceId?: string;
  version?: number;
}

export function buildEnvelope<P>(args: BuildEnvelopeArgs<P>): EventEnvelope<P> {
  const env: EventEnvelope<P> = {
    event_id: randomUUID(),
    event_type: args.topic,
    event_version: args.version ?? 1,
    occurred_at: new Date().toISOString(),
    producer: args.producer,
    payload: args.payload,
  };
  if (args.traceId) env.trace_id = args.traceId;
  return env;
}

const ajv = new Ajv({ strict: false, allErrors: false });
addFormats(ajv);

const validators = new Map<string, { env: ValidateFunction; payload: ValidateFunction }>();

function eventsDir(): string {
  return process.env.EVENTS_DIR ?? DEFAULT_EVENTS_DIR;
}

function loadValidators(topic: string): { env: ValidateFunction; payload: ValidateFunction } {
  const existing = validators.get(topic);
  if (existing) return existing;
  const dir = eventsDir();
  const envelopeSchema = JSON.parse(fs.readFileSync(path.join(dir, '_envelope.schema.json'), 'utf8'));
  const payloadSchema = JSON.parse(fs.readFileSync(path.join(dir, `${topic}.schema.json`), 'utf8'));
  // Strip $id so ajv doesn't complain about duplicate ids when the same schema
  // is compiled under different topic paths.
  delete envelopeSchema.$id;
  delete payloadSchema.$id;
  const env = ajv.compile(envelopeSchema);
  const payload = ajv.compile(payloadSchema);
  const pair = { env, payload };
  validators.set(topic, pair);
  return pair;
}

function formatErrors(errors: ValidateFunction['errors']): string {
  if (!errors) return 'unknown error';
  return errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
}

export class EnvelopeValidationError extends Error {
  constructor(public readonly topic: string, details: string) {
    super(`invalid envelope for ${topic}: ${details}`);
    this.name = 'EnvelopeValidationError';
  }
}

export function validateEnvelope<P = unknown>(
  topic: string,
  candidate: unknown
): EventEnvelope<P> {
  const { env, payload } = loadValidators(topic);
  if (!env(candidate)) throw new EnvelopeValidationError(topic, formatErrors(env.errors));
  const envelope = candidate as EventEnvelope<unknown>;
  if (envelope.event_type !== topic) {
    throw new EnvelopeValidationError(
      topic,
      `event_type mismatch: expected '${topic}', got '${envelope.event_type}'`
    );
  }
  if (!payload(envelope.payload)) {
    throw new EnvelopeValidationError(topic, formatErrors(payload.errors));
  }
  return envelope as EventEnvelope<P>;
}

export function parseEnvelope<P = unknown>(
  topic: string,
  raw: Buffer | string
): EventEnvelope<P> {
  const obj = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
  return validateEnvelope<P>(topic, obj);
}
