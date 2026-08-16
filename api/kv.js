import { Redis } from '@upstash/redis';

// Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from env.
// These are set automatically if you add the Upstash Redis integration
// on Vercel, or you can set them manually — see README.md.
const redis = Redis.fromEnv();

const PERSONAL_PREFIX = 'dayarc:';
const SHARED_PREFIX = 'dayarc:shared:';

function namespacedKey(key, shared) {
  return (shared ? SHARED_PREFIX : PERSONAL_PREFIX) + key;
}

// Optional lightweight protection: if DAYARC_PASSCODE is set in the
// environment, every request must include a matching x-day-arc-key header.
// If it's unset, the API is open (fine for a private/unlisted deployment).
function isAuthorized(req) {
  const passcode = process.env.DAYARC_PASSCODE;
  if (!passcode) return true;
  return req.headers['x-day-arc-key'] === passcode;
}

async function scanAllKeys(matchPrefix) {
  let cursor = '0';
  const found = [];
  do {
    const [nextCursor, batch] = await redis.scan(cursor, {
      match: `${matchPrefix}*`,
      count: 200,
    });
    cursor = nextCursor;
    found.push(...batch);
  } while (cursor !== '0');
  return found;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-day-arc-key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const { action, key, prefix } = req.query;
      const shared = req.query.shared === '1' || req.query.shared === 'true';

      if (action === 'get') {
        if (!key) {
          res.status(400).json({ error: 'key is required' });
          return;
        }
        const raw = await redis.get(namespacedKey(key, shared));
        if (raw === null || raw === undefined) {
          res.status(200).json(null);
          return;
        }
        const value = typeof raw === 'string' ? raw : JSON.stringify(raw);
        res.status(200).json({ key, value, shared });
        return;
      }

      if (action === 'list') {
        const base = namespacedKey(prefix || '', shared);
        const fullKeys = await scanAllKeys(base);
        const stripPrefix = shared ? SHARED_PREFIX : PERSONAL_PREFIX;
        const keys = fullKeys.map((k) => k.slice(stripPrefix.length));
        res.status(200).json({ keys, prefix: prefix || '', shared });
        return;
      }

      res.status(400).json({ error: 'unknown action' });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action, key, value } = body;
      const shared = !!body.shared;

      if (action === 'set') {
        if (!key) {
          res.status(400).json({ error: 'key is required' });
          return;
        }
        await redis.set(namespacedKey(key, shared), value);
        res.status(200).json({ key, value, shared });
        return;
      }

      if (action === 'delete') {
        if (!key) {
          res.status(400).json({ error: 'key is required' });
          return;
        }
        await redis.del(namespacedKey(key, shared));
        res.status(200).json({ key, deleted: true, shared });
        return;
      }

      res.status(400).json({ error: 'unknown action' });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : 'server error' });
  }
}
