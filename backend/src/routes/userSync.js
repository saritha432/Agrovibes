const express = require("express");
const { query, pool } = require("../db");
const { authRequired } = require("../auth");
const { parseMapCoord } = require("../googleMaps");

const router = express.Router();

const CART_KINDS = new Set(["market", "rental"]);
const MAX_CART_ITEMS = 100;
const MAX_QTY = 99;

let cartTablesReady = false;
let locationColumnsReady = false;

async function ensureLocationColumns() {
  if (locationColumnsReady) return;
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS location_label TEXT`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS location_city TEXT`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS location_state TEXT`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS location_postal TEXT`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ`);
  locationColumnsReady = true;
}

async function ensureCartTables() {
  if (cartTablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS user_cart_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      cart_kind TEXT NOT NULL,
      item_key TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      quantity INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS user_cart_items_user_kind_key ON user_cart_items (user_id, cart_kind, item_key)`
  );
  await query(`CREATE INDEX IF NOT EXISTS user_cart_items_user_idx ON user_cart_items (user_id, cart_kind, updated_at DESC)`);
  cartTablesReady = true;
}

function cleanText(value, max) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clampQty(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_QTY, n);
}

function asObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function parseTime(value) {
  if (!value) return 0;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeMarketItem(raw) {
  const src = asObject(raw);
  const id = cleanText(src.id, 180);
  const quantity = clampQty(src.quantity);
  if (!id || quantity <= 0) return null;
  const maxQuantity = src.maxQuantity == null ? undefined : clampQty(src.maxQuantity);
  return {
    key: id,
    quantity,
    payload: {
      id,
      cropName: cleanText(src.cropName, 160) || "Item",
      vendor: cleanText(src.vendor, 160),
      unitPrice: Number.isFinite(Number(src.unitPrice)) ? Number(src.unitPrice) : 0,
      unitLabel: cleanText(src.unitLabel, 80) || "/ unit",
      quantity,
      maxQuantity: maxQuantity || undefined
    }
  };
}

function normalizeRentalItem(raw) {
  const src = asObject(raw);
  const listingId = cleanText(src.listingId, 120);
  const option = cleanText(src.option, 80);
  const quantity = clampQty(src.quantity);
  if (!listingId || !option || quantity <= 0) return null;
  return {
    key: `${listingId}|${option}`,
    quantity,
    payload: {
      listingId,
      title: cleanText(src.title, 160) || "Rental",
      category: cleanText(src.category, 120),
      option,
      quantity,
      unitPrice: Number.isFinite(Number(src.unitPrice)) ? Number(src.unitPrice) : 0,
      unitLabel: cleanText(src.unitLabel, 40) || "Day",
      mrp: Number.isFinite(Number(src.mrp)) ? Number(src.mrp) : Number(src.unitPrice) || 0
    }
  };
}

function normalizeItems(kind, items) {
  const list = Array.isArray(items) ? items.slice(0, MAX_CART_ITEMS) : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const next = kind === "rental" ? normalizeRentalItem(raw) : normalizeMarketItem(raw);
    if (!next || seen.has(next.key)) continue;
    seen.add(next.key);
    out.push(next);
  }
  return out;
}

function rowToItem(kind, row) {
  const payload = asObject(row.payload);
  const quantity = clampQty(row.quantity);
  if (kind === "rental") {
    return {
      ...payload,
      listingId: payload.listingId || String(row.item_key || "").split("|")[0],
      option: payload.option || String(row.item_key || "").split("|").slice(1).join("|"),
      quantity
    };
  }
  return {
    ...payload,
    id: payload.id || row.item_key,
    quantity
  };
}

async function loadCart(userId) {
  const result = await query(
    `
    SELECT cart_kind, item_key, payload, quantity, updated_at
    FROM user_cart_items
    WHERE user_id = $1
    ORDER BY updated_at DESC, id DESC
    `,
    [userId]
  );
  const market = [];
  const rental = [];
  let marketUpdatedAt = null;
  let rentalUpdatedAt = null;
  for (const row of result.rows) {
    const kind = row.cart_kind === "rental" ? "rental" : "market";
    const stamp = row.updated_at ? new Date(row.updated_at).toISOString() : null;
    if (kind === "rental") {
      rental.push(rowToItem("rental", row));
      if (!rentalUpdatedAt) rentalUpdatedAt = stamp;
    } else {
      market.push(rowToItem("market", row));
      if (!marketUpdatedAt) marketUpdatedAt = stamp;
    }
  }
  return { market, rental, marketUpdatedAt, rentalUpdatedAt };
}

async function replaceCart(userId, kind, items) {
  const client = pool && typeof pool.connect === "function" ? await pool.connect() : null;
  const run = async (sql, params) => (client ? client.query(sql, params) : query(sql, params));
  try {
    if (client) await client.query("BEGIN");
    await run(`DELETE FROM user_cart_items WHERE user_id = $1 AND cart_kind = $2`, [userId, kind]);
    for (const item of items) {
      await run(
        `
        INSERT INTO user_cart_items (user_id, cart_kind, item_key, payload, quantity, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
        `,
        [userId, kind, item.key, JSON.stringify(item.payload), item.quantity]
      );
    }
    if (client) await client.query("COMMIT");
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
    }
    throw error;
  } finally {
    if (client) client.release();
  }
}

function locationFromRow(row) {
  if (!row) {
    return {
      label: null,
      lat: null,
      lng: null,
      city: null,
      state: null,
      postal: null,
      updatedAt: null
    };
  }
  const lat = Number(row.locationLat);
  const lng = Number(row.locationLng);
  return {
    label: row.locationLabel ? String(row.locationLabel).trim() : null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    city: row.locationCity ? String(row.locationCity).trim() : null,
    state: row.locationState ? String(row.locationState).trim() : null,
    postal: row.locationPostal ? String(row.locationPostal).trim() : null,
    updatedAt: row.locationUpdatedAt ? new Date(row.locationUpdatedAt).toISOString() : null
  };
}

router.get("/v1/me/cart", authRequired, async (req, res) => {
  try {
    await ensureCartTables();
    const userId = Number(req.user.userId);
    res.json(await loadCart(userId));
  } catch (error) {
    res.status(500).json({ message: "Failed to load cart", error: error?.message || String(error) });
  }
});

router.put("/v1/me/cart/:kind", authRequired, async (req, res) => {
  try {
    await ensureCartTables();
    const kind = String(req.params.kind || "").trim();
    if (!CART_KINDS.has(kind)) {
      res.status(400).json({ message: "Cart kind must be market or rental." });
      return;
    }
    const userId = Number(req.user.userId);
    const items = normalizeItems(kind, req.body?.items);
    const allowEmpty = Boolean(req.body?.allowEmpty);
    const clientUpdatedAt = parseTime(req.body?.clientUpdatedAt);

    const existing = await query(
      `SELECT MAX(updated_at) AS "updatedAt", COUNT(*) AS "count" FROM user_cart_items WHERE user_id = $1 AND cart_kind = $2`,
      [userId, kind]
    );
    const serverCount = Number(existing.rows[0]?.count || 0);
    const serverUpdatedAt = existing.rows[0]?.updatedAt ? new Date(existing.rows[0].updatedAt).getTime() : 0;

    if (items.length === 0 && serverCount > 0 && !allowEmpty && clientUpdatedAt > 0 && serverUpdatedAt > clientUpdatedAt) {
      res.status(409).json({
        message: "Newer cart changes exist on the server.",
        cart: await loadCart(userId)
      });
      return;
    }

    await replaceCart(userId, kind, items);
    res.json(await loadCart(userId));
  } catch (error) {
    res.status(500).json({ message: "Failed to save cart", error: error?.message || String(error) });
  }
});

router.get("/v1/auth/me/location", authRequired, async (req, res) => {
  try {
    await ensureLocationColumns();
    const result = await query(
      `
      SELECT
        location_label AS "locationLabel",
        location_lat AS "locationLat",
        location_lng AS "locationLng",
        location_city AS "locationCity",
        location_state AS "locationState",
        location_postal AS "locationPostal",
        location_updated_at AS "locationUpdatedAt"
      FROM learn_users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ location: locationFromRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load location", error: error?.message || String(error) });
  }
});

router.put("/v1/auth/me/location", authRequired, async (req, res) => {
  try {
    await ensureLocationColumns();
    const label = cleanText(req.body?.label ?? req.body?.locationLabel, 255);
    if (!label) {
      res.status(400).json({ message: "A location address is required." });
      return;
    }
    const lat = parseMapCoord(req.body?.lat ?? req.body?.locationLat, -90, 90);
    const lng = parseMapCoord(req.body?.lng ?? req.body?.locationLng, -180, 180);
    const city = cleanText(req.body?.city ?? req.body?.locationCity, 120) || null;
    const state = cleanText(req.body?.state ?? req.body?.locationState, 120) || null;
    const postal = cleanText(req.body?.postal ?? req.body?.locationPostal, 20) || null;

    const updated = await query(
      `
      UPDATE learn_users
      SET
        location_label = $1,
        location_lat = $2,
        location_lng = $3,
        location_city = $4,
        location_state = $5,
        location_postal = $6,
        location_updated_at = NOW()
      WHERE id = $7
      RETURNING
        location_label AS "locationLabel",
        location_lat AS "locationLat",
        location_lng AS "locationLng",
        location_city AS "locationCity",
        location_state AS "locationState",
        location_postal AS "locationPostal",
        location_updated_at AS "locationUpdatedAt"
      `,
      [label, lat, lng, city, state, postal, req.user.userId]
    );
    if (!updated.rows[0]) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ location: locationFromRow(updated.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: "Failed to save location", error: error?.message || String(error) });
  }
});

module.exports = router;
