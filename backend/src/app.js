import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { CacheClient } from './cache/cacheClient.js';
import { config as defaultConfig } from './config/index.js';
import { createOpenApiDocument } from './docs/openapi.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { ProductRepository } from './repositories/productRepository.js';
import { UserRepository } from './repositories/userRepository.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createProductRoutes } from './routes/productRoutes.js';
import { AuthService } from './services/authService.js';

export async function createApp(overrides = {}) {
  const appConfig = { ...defaultConfig, ...overrides };
  const logger = overrides.logger || console;

  const productRepository = overrides.productRepository || new ProductRepository({ dataDir: appConfig.dataDir });
  const userRepository = overrides.userRepository || new UserRepository({ dataDir: appConfig.dataDir, admin: appConfig.admin });
  await productRepository.init();
  await userRepository.init();

  const uploadsDir = path.join(appConfig.dataDir, 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const cache = overrides.cacheClient || new CacheClient({ redisUrl: appConfig.redisUrl, logger });
  await cache.connect();

  const authService = new AuthService({ userRepository, jwtConfig: appConfig.jwt });
  const openApiDocument = createOpenApiDocument({ apiBaseUrl: appConfig.apiBaseUrl });
  const app = express();
  app.locals.logger = logger;
  app.locals.cache = cache;

  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  });
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );
  const frontendUrls = (appConfig.frontendUrls || [appConfig.frontendUrl])
    .map((url) => normalizeOrigin(url))
    .filter(Boolean);
  const frontendPort = new URL(appConfig.frontendUrl).port || '3001';
  const corsOptions = {
    origin(requestOrigin, callback) {
      // Allow no-origin (curl, Postman, server-to-server)
      if (!requestOrigin) return callback(null, true);
      const normalizedOrigin = normalizeOrigin(requestOrigin);
      try {
        const { hostname, port } = new URL(normalizedOrigin);
        const samePort = port === frontendPort || (!port && (frontendPort === '80' || frontendPort === '443'));
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        // Allow any private-network IP on the same frontend port (LAN access)
        const isPrivateIP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname);
        if (samePort && (isLocalhost || isPrivateIP)) {
          return callback(null, true);
        }
        // Also allow explicitly configured frontend origins.
        if (frontendUrls.includes(normalizedOrigin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS: origin ${requestOrigin} is not allowed`));
      } catch {
        return callback(new Error('CORS: invalid origin'));
      }
    },
    credentials: false
  };
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '64kb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', cache: cache.mode, uptimeSeconds: Math.round(process.uptime()) });
  });
  app.get('/openapi.json', (req, res) => res.json(openApiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use('/api/auth', createRateLimiter({ cache, prefix: 'auth', ...appConfig.rateLimits.auth }));
  app.use('/api/auth', createAuthRoutes({ authService }));

  app.use('/api/products', createRateLimiter({ cache, prefix: 'api', ...appConfig.rateLimits.api }));
  app.use(
    '/api/products',
    createProductRoutes({
      productRepository,
      cache,
      cacheConfig: appConfig.cache,
      requireAuth: requireAuth(appConfig.jwt)
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, productRepository, userRepository, cache };
}

function normalizeOrigin(value) {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}
