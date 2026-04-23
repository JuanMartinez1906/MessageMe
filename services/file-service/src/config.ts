import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  grpcHost: process.env.GRPC_HOST ?? '0.0.0.0',
  grpcPort: parseInt(process.env.GRPC_PORT ?? '50059', 10),

  databaseUrl: required('DATABASE_URL'),

  s3Region: process.env.S3_REGION ?? 'us-east-1',
  s3Bucket: required('S3_BUCKET'),
  // Internal endpoint — reached from inside the container network.
  s3Endpoint: process.env.S3_ENDPOINT ?? '',
  // Public endpoint — embedded in pre-signed URLs so clients outside the Docker
  // network can reach the object store. Falls back to s3Endpoint when unset.
  s3PublicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? '',
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'test',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'test',

  uploadUrlTtlSeconds: parseInt(process.env.UPLOAD_URL_TTL_SECONDS ?? '900', 10),
  downloadUrlTtlSeconds: parseInt(process.env.DOWNLOAD_URL_TTL_SECONDS ?? '3600', 10),

  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'kafka:29092').split(',').map((s) => s.trim()),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'file-service',
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? 'file-service-media-ready',
};
