import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config';

// Two clients — the internal one performs HEAD (to verify a client upload landed),
// the public one signs URLs that clients use from outside the container network.
// The newer AWS SDK attaches an x-amz-checksum-crc32 header to presigned PUTs by
// default. LocalStack rejects that request, so we opt out via the WHEN_REQUIRED
// checksum modes. Real AWS S3 accepts both modes.
const commonOpts = {
  region: config.s3Region,
  forcePathStyle: config.s3ForcePathStyle,
  credentials: { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretAccessKey },
  requestChecksumCalculation: 'WHEN_REQUIRED' as const,
  responseChecksumValidation: 'WHEN_REQUIRED' as const,
};

const internalClient = new S3Client({
  ...commonOpts,
  endpoint: config.s3Endpoint || undefined,
});

const publicClient = new S3Client({
  ...commonOpts,
  endpoint: config.s3PublicEndpoint || undefined,
});

export async function presignPut(args: {
  key: string;
  contentType: string;
}): Promise<{ url: string; expiresAt: Date }> {
  const cmd = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: args.key,
    ContentType: args.contentType,
  });
  const url = await getSignedUrl(publicClient, cmd, { expiresIn: config.uploadUrlTtlSeconds });
  return { url, expiresAt: new Date(Date.now() + config.uploadUrlTtlSeconds * 1000) };
}

export async function presignGet(key: string): Promise<{ url: string; expiresAt: Date }> {
  const cmd = new GetObjectCommand({ Bucket: config.s3Bucket, Key: key });
  const url = await getSignedUrl(publicClient, cmd, { expiresIn: config.downloadUrlTtlSeconds });
  return { url, expiresAt: new Date(Date.now() + config.downloadUrlTtlSeconds * 1000) };
}

export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const res = await internalClient.send(new HeadObjectCommand({ Bucket: config.s3Bucket, Key: key }));
    return { size: Number(res.ContentLength ?? 0), contentType: res.ContentType };
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return null;
    throw err;
  }
}
