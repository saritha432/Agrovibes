const { Redis } = require("@upstash/redis");

function createClient() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createClient();

if (redis) {
  // eslint-disable-next-line no-console
  console.log("[cache] Upstash Redis enabled");
}

function parseGet(val) {
  if (val == null) return null;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  if (typeof val === "object") return val;
  return null;
}

function isRedisConfigured() {
  return Boolean(redis);
}

async function cachePing() {
  if (!redis) return { ok: false, skipped: true };
  try {
    const pong = await redis.ping();
    return { ok: pong === "PONG" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function cacheGetJson(key) {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return parseGet(raw);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[cache] get", key, e.message);
    return null;
  }
}

async function cacheSetJson(key, value, ttlSeconds) {
  if (!redis) return;
  try {
    const ex = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : 60;
    await redis.set(key, JSON.stringify(value), { ex });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[cache] set", key, e.message);
  }
}

async function cacheDel(key) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[cache] del", key, e.message);
  }
}

/** Bump cache generation so keys scoped with the previous gen become stale. */
async function cacheIncr(key) {
  if (!redis) return 0;
  try {
    return await redis.incr(key);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[cache] incr", key, e.message);
    return 0;
  }
}

async function cacheGenString(key) {
  if (!redis) return "0";
  try {
    const v = await redis.get(key);
    if (v == null || v === undefined) return "0";
    return String(v);
  } catch {
    return "0";
  }
}

module.exports = {
  redis,
  isRedisConfigured,
  cachePing,
  cacheGetJson,
  cacheSetJson,
  cacheDel,
  cacheIncr,
  cacheGenString
};
