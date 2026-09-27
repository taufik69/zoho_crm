/** Optional Redis cache. Redis outages degrade to uncached Zoho requests. */
import { createClient } from 'redis';
import config from '../../config/env.js';
import { createLogger } from '../../config/logger.js';

const log = createLogger('redis');
const client = createClient({
  url: config.redis.url,
  socket: { reconnectStrategy: (retries) => retries > 1 ? false : retries * 200 },
});
client.on('error', (err) => log.warn({ err }, 'Redis unavailable; requests will bypass cache'));
let connecting;

const getClient = async () => {
  if (client.isReady) return client;
  if (!connecting) {
    connecting = client.connect().catch((err) => {
      log.warn({ err }, 'Redis connection failed');
      return null;
    }).finally(() => { connecting = null; });
  }
  await connecting;
  return client.isReady ? client : null;
};

const getVersion = async (redis) => {
  const key = 'crm:cache:version';
  let version = await redis.get(key);
  if (!version) {
    await redis.set(key, '1', { NX: true });
    version = await redis.get(key);
  }
  return version || '1';
};

const get = async (key) => {
  try {
    const redis = await getClient();
    if (!redis) return { version: null, value: null };
    const version = await getVersion(redis);
    const value = await redis.get(`crm:cache:v${version}:${key}`);
    return { version, value: value === null ? null : JSON.parse(value) };
  } catch (err) {
    log.warn({ err }, 'Redis cache read failed');
    return { version: null, value: null };
  }
};

const set = async (key, value, version) => {
  try {
    const redis = await getClient();
    if (!redis || version === null) return;
    await redis.set(`crm:cache:v${version}:${key}`, JSON.stringify(value), {
      EX: config.redis.cacheTtlSeconds,
    });
  } catch (err) {
    log.warn({ err }, 'Redis cache write failed');
  }
};

const invalidate = async () => {
  try {
    const redis = await getClient();
    if (redis) await redis.incr('crm:cache:version');
  } catch (err) {
    log.warn({ err }, 'Redis cache invalidation failed');
  }
};

export default { get, set, invalidate };
