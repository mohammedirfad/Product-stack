import { createClient } from 'redis';

export class CacheClient {
  constructor({ redisUrl, logger = console }) {
    this.redisUrl = redisUrl;
    this.logger = logger;
    this.client = null;
    this.memory = new Map();
    this.mode = 'memory';
  }

  async connect() {
    if (!this.redisUrl) return;

    this.client = createClient({ url: this.redisUrl });
    this.client.on('error', (error) => {
      this.mode = 'memory';
      this.logger.warn?.(`Redis unavailable, using memory cache: ${error.message}`);
    });

    try {
      await this.client.connect();
      this.mode = 'redis';
      this.logger.info?.('Redis cache connected.');
    } catch (error) {
      this.mode = 'memory';
      this.logger.warn?.(`Redis connection failed, using memory cache: ${error.message}`);
    }
  }

  async getJson(key) {
    if (this.mode === 'redis' && this.client?.isOpen) {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    }

    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  async setJson(key, value, ttlSeconds) {
    if (this.mode === 'redis' && this.client?.isOpen) {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
      return;
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delPrefix(prefix) {
    if (this.mode === 'redis' && this.client?.isOpen) {
      const keys = [];
      for await (const key of this.client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
        keys.push(key);
      }
      if (keys.length) await this.client.del(keys);
      return;
    }

    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  async close() {
    if (this.client?.isOpen) await this.client.quit();
  }
}
