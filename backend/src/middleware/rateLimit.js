export function createRateLimiter({ cache, prefix, windowMs, max }) {
  const memory = new Map();

  return async (req, res, next) => {
    const ip = String(req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown')
      .split(',')[0]
      .trim();
    const windowId = Math.floor(Date.now() / windowMs);
    const key = `rate:${prefix}:${ip}:${windowId}`;

    try {
      const current = await increment(cache, memory, key, Math.ceil(windowMs / 1000));
      res.setHeader('x-ratelimit-limit', String(max));
      res.setHeader('x-ratelimit-remaining', String(Math.max(0, max - current)));

      if (current > max) {
        res.setHeader('retry-after', String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({
          error: {
            code: 'rate_limited',
            message: 'Too many requests. Please slow down and try again.'
          }
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

async function increment(cache, memory, key, ttlSeconds) {
  if (cache.mode === 'redis' && cache.client?.isOpen) {
    const value = await cache.client.incr(key);
    if (value === 1) await cache.client.expire(key, ttlSeconds);
    return value;
  }

  const now = Date.now();
  const existing = memory.get(key);
  if (!existing || existing.expiresAt < now) {
    memory.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}
