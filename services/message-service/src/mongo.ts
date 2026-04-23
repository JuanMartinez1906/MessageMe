import { MongoClient, Db, Collection } from 'mongodb';
import { config } from './config';

export interface MessageDoc {
  _id: string; // message_id (uuid)
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';
  content: string;
  fileUrl?: string | null;
  // Exactly one populated:
  channelId?: string | null;
  conversationId?: string | null;
  createdAt: Date;
  editedAt?: Date | null;
  clientMessageId?: string | null;
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.mongoUrl);
  await client.connect();
  db = client.db(config.mongoDb);
  // Indexes. Shard key would be channelId in prod; in dev we stick with compound indexes.
  const msgs = db.collection<MessageDoc>('messages');
  await Promise.all([
    msgs.createIndex({ channelId: 1, createdAt: -1 }),
    msgs.createIndex({ conversationId: 1, createdAt: -1 }),
    msgs.createIndex(
      { senderId: 1, clientMessageId: 1 },
      { unique: true, partialFilterExpression: { clientMessageId: { $exists: true, $type: 'string' } } }
    ),
  ]);
  return db;
}

export function messages(): Collection<MessageDoc> {
  if (!db) throw new Error('Mongo not connected');
  return db.collection<MessageDoc>('messages');
}

export async function disconnectMongo(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
