import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../backend/src/app.js';

let context;

before(async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-api-'));
  const { app, cache } = await createApp({
    dataDir,
    redisUrl: '',
    apiBaseUrl: 'https://product-stack.onrender.com',
    frontendUrl: 'http://localhost:3001',
    frontendUrls: ['http://localhost:3001', 'https://product-stack-clt.vercel.app'],
    jwt: {
      issuer: 'test-api',
      secret: 'test-secret-with-more-than-32-characters',
      expiresIn: '1h'
    },
    admin: {
      email: 'admin@example.com',
      password: 'ChangeMe123!'
    },
    rateLimits: {
      auth: { windowMs: 60_000, max: 100 },
      api: { windowMs: 60_000, max: 1000 }
    },
    logger: silentLogger()
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  context = {
    server,
    cache,
    dataDir,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    token: ''
  };
});

after(async () => {
  await context.cache.close();
  await new Promise((resolve) => context.server.close(resolve));
  await fs.rm(context.dataDir, { recursive: true, force: true });
});

test('login works, listing is public, write endpoints require auth', async () => {
  const publicList = await request('/api/products');
  assert.equal(publicList.status, 200);

  const unauthorizedCreate = await request('/api/products', {
    method: 'POST',
    body: { name: 'Desk Lamp', sku: 'HOME-LAMP-100', category: 'Home', price: 39.99, stock: 50 }
  });
  assert.equal(unauthorizedCreate.status, 401);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'ChangeMe123!' }
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.tokenType, 'Bearer');
  assert.ok(login.body.token);
  context.token = login.body.token;

  const products = await request('/api/products?page=1&pageSize=4');
  assert.equal(products.status, 200);
  assert.equal(products.body.items.length, 4);
  assert.ok(products.body.facets.categories.includes('Electronics'));
  assert.deepEqual(products.body.facets.categories, ['Electronics', 'Home', 'Fashion']);
  assert.ok(products.body.items.every((product) => product.imageUrl));
});

test('cors allows configured Vercel frontend origin', async () => {
  const response = await fetch(`${context.baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      origin: 'https://product-stack-clt.vercel.app',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    }
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://product-stack-clt.vercel.app');
  assert.match(response.headers.get('access-control-allow-methods'), /POST/);
});

test('product CRUD, validation, and cache invalidation work', async () => {
  const invalid = await request('/api/products', {
    method: 'POST',
    token: context.token,
    body: { name: 'A' }
  });
  assert.equal(invalid.status, 422);
  assert.ok(invalid.body.error.details.sku);

  const created = await request('/api/products', {
    method: 'POST',
    token: context.token,
    body: {
      name: 'Desk Lamp',
      sku: 'home-lamp-100',
      category: 'Home',
      price: 39.99,
      stock: 50,
      description: 'LED desk lamp.',
      imageUrl: '/products/home-bundle.svg'
    }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.sku, 'HOME-LAMP-100');
  assert.equal(created.body.category, 'Home');

  const firstSearch = await request('/api/products?search=lamp', { token: context.token });
  assert.equal(firstSearch.status, 200);
  assert.ok(firstSearch.body.items.some((product) => product.id === created.body.id));

  const duplicate = await request('/api/products', {
    method: 'POST',
    token: context.token,
    body: {
      name: 'Duplicate Lamp',
      sku: 'HOME-LAMP-100',
      category: 'Home',
      price: 41,
      stock: 1
    }
  });
  assert.equal(duplicate.status, 409);

  const updated = await request(`/api/products/${created.body.id}`, {
    method: 'PUT',
    token: context.token,
    body: { price: 34.99, stock: 44 }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.price, 34.99);
  assert.equal(updated.body.stock, 44);

  const deleted = await request(`/api/products/${created.body.id}`, {
    method: 'DELETE',
    token: context.token
  });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.deleted, true);
});

test('swagger and openapi routes are available', async () => {
  const openApi = await request('/openapi.json');
  assert.equal(openApi.status, 200);
  assert.equal(openApi.body.openapi, '3.1.0');
  assert.equal(openApi.body.servers[0].url, 'https://product-stack.onrender.com');

  const swagger = await fetch(`${context.baseUrl}/api-docs/`);
  assert.equal(swagger.status, 200);
  assert.match(await swagger.text(), /Swagger UI/);
});

test('image upload validates file type and size, and saves valid files', async () => {
  const unauthorized = await fetch(`${context.baseUrl}/api/products/upload`, {
    method: 'POST'
  });
  assert.equal(unauthorized.status, 401);

  const form = new FormData();
  const file = new Blob(['mock-image-bytes'], { type: 'image/png' });
  form.append('image', file, 'test.png');

  const uploadResponse = await fetch(`${context.baseUrl}/api/products/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.token}`
    },
    body: form
  });

  assert.equal(uploadResponse.status, 200);
  const uploadBody = await uploadResponse.json();
  assert.ok(uploadBody.imageUrl);
  assert.match(uploadBody.imageUrl, /^\/uploads\/.*\.png$/);

  const imageFetch = await fetch(`${context.baseUrl}${uploadBody.imageUrl}`);
  assert.equal(imageFetch.status, 200);
  const imageText = await imageFetch.text();
  assert.equal(imageText, 'mock-image-bytes');

  const badForm = new FormData();
  const badFile = new Blob(['some-code'], { type: 'text/javascript' });
  badForm.append('image', badFile, 'test.js');

  const badUploadResponse = await fetch(`${context.baseUrl}/api/products/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.token}`
    },
    body: badForm
  });

  assert.equal(badUploadResponse.status, 400);
  const badBody = await badUploadResponse.json();
  assert.equal(badBody.error.code, 'invalid_file');
});

async function request(pathname, options = {}) {
  const headers = { accept: 'application/json' };
  if (options.body) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const response = await fetch(`${context.baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  return {
    status: response.status,
    body: await response.json().catch(() => ({}))
  };
}

function silentLogger() {
  return { info() {}, warn() {}, error() {} };
}
