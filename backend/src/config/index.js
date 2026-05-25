import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const defaultDevSecret = 'dev-only-secret-change-before-production-32chars';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
const frontendUrls = [
  frontendUrl,
  ...(process.env.FRONTEND_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
];

export const config = {
  rootDir,
  dataDir: path.resolve(rootDir, process.env.DATA_DIR || './data'),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPort: Number(process.env.API_PORT || process.env.PORT || 4000),
  frontendUrl,
  frontendUrls,
  jwt: {
    issuer: 'secure-product-catalog-api',
    secret: process.env.JWT_SECRET || defaultDevSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!'
  },
  redisUrl: process.env.REDIS_URL || '',
  cache: {
    listTtlSeconds: Number(process.env.PRODUCT_LIST_CACHE_TTL || 30),
    detailTtlSeconds: Number(process.env.PRODUCT_DETAIL_CACHE_TTL || 60)
  },
  rateLimits: {
    auth: { windowMs: 60_000, max: 8 },
    api: { windowMs: 60_000, max: 180 }
  }
};

export function assertSecureConfig(appConfig = config) {
  if (appConfig.nodeEnv === 'production' && appConfig.jwt.secret === defaultDevSecret) {
    throw new Error('JWT_SECRET must be configured in production.');
  }

  if (appConfig.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters.');
  }
}
