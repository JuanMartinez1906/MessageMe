import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config';

const client = new S3Client({
  region: config.s3Region,
  endpoint: config.s3Endpoint || undefined,
  forcePathStyle: config.s3ForcePathStyle,
  credentials: { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretAccessKey },
  // Match file-service: LocalStack doesn't tolerate default checksum headers.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export async function downloadObject(key: string): Promise<Buffer> {
  const res = await client.send(new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }));
  const body = res.Body as NodeJS.ReadableStream;
  if (!body) throw new Error(`empty body for s3://${config.s3Bucket}/${key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

export async function uploadObject(args: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
    })
  );
}
