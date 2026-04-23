import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  grpcHost: process.env.GRPC_HOST ?? '0.0.0.0',
  grpcPort: parseInt(process.env.GRPC_PORT ?? '50051', 10),

  databaseUrl: required('DATABASE_URL'),

  userServiceAddr: process.env.USER_SERVICE_ADDR ?? 'localhost:50052',

  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtlSeconds: parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? '900', 10), // 15m
  refreshTtlSeconds: parseInt(process.env.JWT_REFRESH_TTL_SECONDS ?? '604800', 10), // 7d

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10),
};
