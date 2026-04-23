import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  grpcHost: process.env.GRPC_HOST ?? '0.0.0.0',
  grpcPort: parseInt(process.env.GRPC_PORT ?? '50054', 10),
  databaseUrl: required('DATABASE_URL'),
  groupServiceAddr: process.env.GROUP_SERVICE_ADDR ?? 'localhost:50053',
};
