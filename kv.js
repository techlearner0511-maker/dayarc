import { sql } from '@vercel/postgres';

// Reads POSTGRES_URL (and friends) from env — set automatically when you
// add the Postgres/Neon storage integration on Vercel. See README.md.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS dayarc_kv (
      namespace text NOT NULL,
      key text NOT NULL,
      value text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (namespace, key)
    );
  `;
}

function ns(shared) {
  return shared ? 'shared' : 'personal';
}

// Optional lightweight protection: if DAYARC_PASSCODE is set in the
// environment, every request must include a matching x-day-arc-key header.
// If it's unset, the API is open (fine for a private/unlisted deployment).
function isAuthorized(req) {
  const passcode = process.env.DAYARC_PASSCODE;
  if (!passcode) return true;
  return req.headers['x-day-arc-key'] === passcode;
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
    await ensureTable();

    if (req.method === 'GET') {
      const { action, key, prefix } = req.query;
      const shared = req.query.shared === '1' || req.query.shared === 'true';
      const namespace = ns(shared);

      if (action === 'get') {
        if (!key) {
          res.status(400).json({ error: 'key is required' });
          return;
        }
        const { rows } = await sql`
          SELECT value FROM dayarc_kv WHERE namespace = ${namespace} AND key = ${key}
        `;
        if (!rows.length) {
          res.status(200).json(null);
          return;
        }
        res.status(200).json({ key, value: rows[0].value, shared });
        return;
      }

      if (action === 'list') {
        const pattern = `${prefix || ''}%`;
        const { rows } = await sql`
          SELECT key FROM dayarc_kv WHERE namespace = ${namespace} AND key LIKE ${pattern}
        `;
        res.status(200).json({ keys: rows.map((r) => r.key), prefix: prefix || '', shared });
        return;
      }

      res.status(400).json({ error: 'unknown action' });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action, key, value } = body;
      const shared = !!body.shared;
      const namespace = ns(shared);

      if (action === 'set') {
        if (!key) {
          res.status(400).json({ error: 'key is required' });
          return;
        }
        await sql`
          INSERT INTO dayarc_kv (namespace, key, value)
          VALUES (${namespace}, ${key}, ${value})
          ON CONFLICT (namespace, key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        `;
        res.status(200).json({ key, value, shared });
        return;
      }

      if (action === 'delete') {
        if (!key) {
          res.status(400).json({ error: 'key is required' });
          return;
        }
        await sql`DELETE FROM dayarc_kv WHERE namespace = ${namespace} AND key = ${key}`;
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
