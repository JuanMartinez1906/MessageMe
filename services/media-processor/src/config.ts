import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  s3Region: process.env.S3_REGION ?? 'us-east-1',
  s3Bucket: required('S3_BUCKET'),
  s3Endpoint: process.env.S3_ENDPOINT ?? '',
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'test',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'test',

  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'kafka:29092').split(',').map((s) => s.trim()),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'media-processor',
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? 'media-processor-files-uploaded',

  thumbnailMaxWidth: parseInt(process.env.THUMBNAIL_MAX_WIDTH ?? '512', 10),
  thumbnailMaxHeight: parseInt(process.env.THUMBNAIL_MAX_HEIGHT ?? '512', 10),
  thumbnailQuality: parseInt(process.env.THUMBNAIL_QUALITY ?? '80', 10),
};
