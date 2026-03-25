import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'changeme_secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'changeme_refresh_secret',
  // Support both FRONTEND_URL (new) and CLIENT_URL (legacy)
  clientUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
};

export const isProduction = config.nodeEnv === 'production';
