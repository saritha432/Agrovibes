const express = require("express");
const { query } = require("../db");
const { authRequired } = require("../auth");
const { analyzePlantImages, isPlantHealthAiConfigured } = require("../plantHealthAi");

const router = express.Router();

const PLANT_TYPES = new Set(["crop", "vegetable", "fruit", "tree", "flower", "houseplant", "other"]);
const SCAN_LANGUAGES = new Set(["English", "Hindi", "Telugu", "Kannada", "Malayalam", "Tamil", "Marathi", "Bengali"]);
const MAX_PLANTS_PER_USER = 200;

let plantHealthTablesReady = false;

async function ensurePlantHealthTables() {
  if (plantHealthTablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS plant_health_plants (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      plant_type TEXT NOT NULL DEFAULT 'crop',
      species TEXT,
      growth_stage TEXT,
      location_label TEXT,
      image_url TEXT,
      last_health_score INTEGER,
      last_health_status TEXT,
      last_scan_at TIMESTAMPTZ,
      next_scan_due_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS plant_health_plants_user_idx ON plant_health_plants (user_id, updated_at DESC)`);
  await query(`
    CREATE TABLE IF NOT EXISTS plant_health_scans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plant_id INTEGER,
      image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      context JSONB NOT NULL DEFAULT '{}'::jsonb,
      language TEXT NOT NULL DEFAULT 'English',
      health_score INTEGER,
      health_status TEXT,
      confidence INTEGER,
      result JSONB NOT NULL DEFAULT '{}'::jsonb,
      model TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS plant_health_scans_user_idx ON plant_health_scans (user_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS plant_health_scans_plant_idx ON plant_health_scans (plant_id, created_at DESC)`);
  plantHealthTablesReady = true;
}

function cleanText(value, max) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isPrivateHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^(127|10|0)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host === "::1" || host.startsWith("[")) return true;
  return false;
}

/** Only accept photos that were uploaded to our public media storage. */
function sanitizeImageUrls(input) {
  const production = process.env.NODE_ENV === "production";
  const out = [];
  for (const raw of Array.isArray(input) ? input : []) {
    const value = String(raw || "").trim();
    if (!value || value.length > 1000) continue;
    let url;
    try {
      url = new URL(value);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && !production)) continue;
    if (production && isPrivateHost(url.hostname)) continue;
    if (!out.includes(url.toString())) out.push(url.toString());
    if (out.length >= 4) break;
  }
  return out;
}

const PLANT_SELECT = `
  p.id,
  p.name,
  p.plant_type AS "plantType",
  p.species,
  p.growth_stage AS "growthStage",
  p.location_label AS "locationLabel",
  p.image_url AS "imageUrl",
  p.last_health_score AS "lastHealthScore",
  p.last_health_status AS "lastHealthStatus",
  p.last_scan_at AS "lastScanAt",
  p.next_scan_due_at AS "nextScanDueAt",
  p.created_at AS "createdAt",
  COALESCE(sc.n, 0) AS "scansCount"
`;

/** `userParam` is the SQL placeholder holding the owner's user id (e.g. "$2"). */
function plantFrom(userParam) {
  return `plant_health_plants p
    LEFT JOIN (
      SELECT plant_id, COUNT(*)::int AS n FROM plant_health_scans WHERE user_id = ${userParam} GROUP BY plant_id
    ) sc ON sc.plant_id = p.id`;
}

function scanSummaryFromRow(row) {
  const result = parseJson(row.result, {});
  const imageUrls = parseJson(row.imageUrls, []);
  const topIssue = Array.isArray(result?.issues) && result.issues[0] ? result.issues[0].name : "";
  return {
    id: row.id,
    plantId: row.plantId ?? null,
    plantName: row.plantName || null,
    imageUrl: Array.isArray(imageUrls) ? imageUrls[0] || null : null,
    healthScore: row.healthScore,
    healthStatus: row.healthStatus,
    confidence: row.confidence,
    title: row.plantName || result?.plant?.commonName || "",
    topIssue,
    createdAt: row.createdAt
  };
}

function scanFromRow(row) {
  return {
    id: row.id,
    plantId: row.plantId ?? null,
    plantName: row.plantName || null,
    imageUrls: parseJson(row.imageUrls, []),
    context: parseJson(row.context, {}),
    language: row.language,
    healthScore: row.healthScore,
    healthStatus: row.healthStatus,
    confidence: row.confidence,
    result: parseJson(row.result, {}),
    createdAt: row.createdAt
  };
}

const SCAN_SELECT = `
  s.id,
  s.plant_id AS "plantId",
  p.name AS "plantName",
  s.image_urls AS "imageUrls",
  s.context,
  s.language,
  s.health_score AS "healthScore",
  s.health_status AS "healthStatus",
  s.confidence,
  s.result,
  s.created_at AS "createdAt"
`;

async function loadOwnedPlant(userId, plantId) {
  const result = await query(
    `SELECT ${PLANT_SELECT} FROM ${plantFrom("$2")} WHERE p.id = $1 AND p.user_id = $2 LIMIT 1`,
    [plantId, userId]
  );
  return result.rows[0] || null;
}

async function loadOwnedScan(userId, scanId) {
  const result = await query(
    `SELECT ${SCAN_SELECT}
     FROM plant_health_scans s
     LEFT JOIN plant_health_plants p ON p.id = s.plant_id
     WHERE s.id = $1 AND s.user_id = $2
     LIMIT 1`,
    [scanId, userId]
  );
  return result.rows[0] || null;
}

/** Recomputes a plant's "latest scan" summary from its newest remaining scan. */
async function refreshPlantSummary(plantId) {
  const latest = await query(
    `SELECT health_score AS "healthScore", health_status AS "healthStatus", result, image_urls AS "imageUrls", created_at AS "createdAt"
     FROM plant_health_scans WHERE plant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [plantId]
  );
  const row = latest.rows[0];
  if (!row) {
    await query(
      `UPDATE plant_health_plants
       SET last_health_score = NULL, last_health_status = NULL, last_scan_at = NULL, next_scan_due_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [plantId]
    );
    return;
  }
  const result = parseJson(row.result, {});
  const rescanDays = Math.min(14, Math.max(3, Number(result?.rescanInDays) || 7));
  const imageUrls = parseJson(row.imageUrls, []);
  const nextDueAt = new Date(new Date(row.createdAt).getTime() + rescanDays * 24 * 60 * 60 * 1000);
  await query(
    `UPDATE plant_health_plants
     SET last_health_score = $2,
         last_health_status = $3,
         last_scan_at = $4,
         next_scan_due_at = $5,
         image_url = COALESCE(image_url, $6),
         species = CASE WHEN species IS NULL OR species = '' THEN $7 ELSE species END,
         updated_at = NOW()
     WHERE id = $1`,
    [
      plantId,
      row.healthScore,
      row.healthStatus,
      row.createdAt,
      nextDueAt.toISOString(),
      Array.isArray(imageUrls) ? imageUrls[0] || null : null,
      cleanText(result?.plant?.commonName, 120) || null
    ]
  );
}

function readPlantInput(body) {
  const name = cleanText(body?.name, 80);
  const typeRaw = cleanText(body?.plantType, 20).toLowerCase();
  return {
    name,
    plantType: PLANT_TYPES.has(typeRaw) ? typeRaw : "crop",
    growthStage: cleanText(body?.growthStage, 40) || null,
    locationLabel: cleanText(body?.locationLabel, 120) || null
  };
}

async function createPlant(userId, input) {
  const count = await query(`SELECT COUNT(*)::int AS n FROM plant_health_plants WHERE user_id = $1`, [userId]);
  if ((count.rows[0]?.n || 0) >= MAX_PLANTS_PER_USER) {
    const error = new Error(`You can save up to ${MAX_PLANTS_PER_USER} plants.`);
    error.status = 400;
    throw error;
  }
  const inserted = await query(
    `INSERT INTO plant_health_plants (user_id, name, plant_type, growth_stage, location_label)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, input.name, input.plantType, input.growthStage, input.locationLabel]
  );
  return loadOwnedPlant(userId, inserted.rows[0].id);
}

function sendError(res, error, fallback) {
  const status = Number(error?.status) || 500;
  res.status(status).json({
    message: status >= 500 && !error?.status ? fallback : error?.message || fallback,
    code: error?.code
  });
}

router.get("/v1/plant-health/status", authRequired, (_req, res) => {
  res.json({ configured: isPlantHealthAiConfigured() });
});

router.get("/v1/plant-health/plants", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const result = await query(
      `SELECT ${PLANT_SELECT} FROM ${plantFrom("$1")} WHERE p.user_id = $1 ORDER BY COALESCE(p.last_scan_at, p.created_at) DESC LIMIT $2`,
      [req.user.userId, MAX_PLANTS_PER_USER]
    );
    res.json({ plants: result.rows });
  } catch (error) {
    sendError(res, error, "Could not load your plants");
  }
});

router.post("/v1/plant-health/plants", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const input = readPlantInput(req.body);
    if (!input.name) {
      res.status(400).json({ message: "Plant name is required" });
      return;
    }
    const plant = await createPlant(req.user.userId, input);
    res.status(201).json({ plant });
  } catch (error) {
    sendError(res, error, "Could not save the plant");
  }
});

router.get("/v1/plant-health/plants/:id", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const plantId = parseId(req.params.id);
    const plant = plantId ? await loadOwnedPlant(req.user.userId, plantId) : null;
    if (!plant) {
      res.status(404).json({ message: "Plant not found" });
      return;
    }
    const scans = await query(
      `SELECT ${SCAN_SELECT}
       FROM plant_health_scans s
       LEFT JOIN plant_health_plants p ON p.id = s.plant_id
       WHERE s.plant_id = $1 AND s.user_id = $2
       ORDER BY s.created_at DESC
       LIMIT 60`,
      [plantId, req.user.userId]
    );
    res.json({ plant, scans: scans.rows.map(scanSummaryFromRow) });
  } catch (error) {
    sendError(res, error, "Could not load the plant");
  }
});

router.put("/v1/plant-health/plants/:id", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const plantId = parseId(req.params.id);
    const existing = plantId ? await loadOwnedPlant(req.user.userId, plantId) : null;
    if (!existing) {
      res.status(404).json({ message: "Plant not found" });
      return;
    }
    const input = readPlantInput({ ...existing, ...req.body });
    if (!input.name) {
      res.status(400).json({ message: "Plant name is required" });
      return;
    }
    await query(
      `UPDATE plant_health_plants
       SET name = $3, plant_type = $4, growth_stage = $5, location_label = $6, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [plantId, req.user.userId, input.name, input.plantType, input.growthStage, input.locationLabel]
    );
    res.json({ plant: await loadOwnedPlant(req.user.userId, plantId) });
  } catch (error) {
    sendError(res, error, "Could not update the plant");
  }
});

router.delete("/v1/plant-health/plants/:id", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const plantId = parseId(req.params.id);
    const existing = plantId ? await loadOwnedPlant(req.user.userId, plantId) : null;
    if (!existing) {
      res.status(404).json({ message: "Plant not found" });
      return;
    }
    await query(`DELETE FROM plant_health_scans WHERE plant_id = $1 AND user_id = $2`, [plantId, req.user.userId]);
    await query(`DELETE FROM plant_health_plants WHERE id = $1 AND user_id = $2`, [plantId, req.user.userId]);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error, "Could not delete the plant");
  }
});

router.get("/v1/plant-health/scans", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const onlyUnsaved = String(req.query.unsaved || "") === "1";
    const result = await query(
      `SELECT ${SCAN_SELECT}
       FROM plant_health_scans s
       LEFT JOIN plant_health_plants p ON p.id = s.plant_id
       WHERE s.user_id = $1 ${onlyUnsaved ? "AND s.plant_id IS NULL" : ""}
       ORDER BY s.created_at DESC
       LIMIT $2`,
      [req.user.userId, limit]
    );
    res.json({ scans: result.rows.map(scanSummaryFromRow) });
  } catch (error) {
    sendError(res, error, "Could not load scans");
  }
});

router.get("/v1/plant-health/scans/:id", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const scanId = parseId(req.params.id);
    const row = scanId ? await loadOwnedScan(req.user.userId, scanId) : null;
    if (!row) {
      res.status(404).json({ message: "Scan not found" });
      return;
    }
    res.json({ scan: scanFromRow(row) });
  } catch (error) {
    sendError(res, error, "Could not load the scan");
  }
});

router.post("/v1/plant-health/scans", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const userId = req.user.userId;
    const imageUrls = sanitizeImageUrls(req.body?.imageUrls);
    if (!imageUrls.length) {
      res.status(400).json({ message: "Add at least one clear photo of the plant." });
      return;
    }

    const dailyLimit = Math.max(1, Number(process.env.PLANT_SCAN_DAILY_LIMIT) || 25);
    const today = await query(
      `SELECT COUNT(*)::int AS n FROM plant_health_scans WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day'`,
      [userId]
    );
    if ((today.rows[0]?.n || 0) >= dailyLimit) {
      res.status(429).json({ message: `You have reached today's limit of ${dailyLimit} scans. Please try again tomorrow.` });
      return;
    }

    let plantId = parseId(req.body?.plantId);
    let plant = null;
    if (plantId) {
      plant = await loadOwnedPlant(userId, plantId);
      if (!plant) {
        res.status(404).json({ message: "Plant not found" });
        return;
      }
    }

    const languageRaw = cleanText(req.body?.language, 20);
    const language = SCAN_LANGUAGES.has(languageRaw) ? languageRaw : "English";
    const rawContext = req.body?.context && typeof req.body.context === "object" ? req.body.context : {};
    const context = {
      plantName: cleanText(rawContext.plantName || plant?.name, 80),
      plantType: cleanText(rawContext.plantType || plant?.plantType, 20),
      growthStage: cleanText(rawContext.growthStage || plant?.growthStage, 40),
      symptoms: cleanText(rawContext.symptoms, 400),
      recentInputs: cleanText(rawContext.recentInputs, 200),
      watering: cleanText(rawContext.watering, 120),
      photoLabels: (Array.isArray(rawContext.photoLabels) ? rawContext.photoLabels : [])
        .map((x) => cleanText(x, 40))
        .slice(0, imageUrls.length)
    };

    const promptContext = { ...context };
    if (plant) {
      const prev = await query(
        `SELECT health_score AS "healthScore", result FROM plant_health_scans WHERE plant_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [plant.id]
      );
      const prevRow = prev.rows[0];
      if (prevRow) {
        const prevResult = parseJson(prevRow.result, {});
        promptContext.previousScore = prevRow.healthScore;
        promptContext.previousIssues = (Array.isArray(prevResult?.issues) ? prevResult.issues : [])
          .map((issue) => issue?.name)
          .filter(Boolean)
          .slice(0, 3);
      }
    }

    const userRow = await query(`SELECT location_label AS "locationLabel" FROM learn_users WHERE id = $1 LIMIT 1`, [userId]).catch(
      () => ({ rows: [] })
    );
    const locationLabel = plant?.locationLabel || userRow.rows[0]?.locationLabel || "";

    const { diagnosis, model } = await analyzePlantImages({
      imageUrls,
      language,
      context: promptContext,
      locationLabel
    });

    const inserted = await query(
      `INSERT INTO plant_health_scans
        (user_id, plant_id, image_urls, context, language, health_score, health_status, confidence, result, model)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10)
       RETURNING id`,
      [
        userId,
        plantId,
        JSON.stringify(imageUrls),
        JSON.stringify(context),
        language,
        diagnosis.healthScore,
        diagnosis.healthStatus,
        diagnosis.overallConfidence,
        JSON.stringify(diagnosis),
        model
      ]
    );
    const scanId = inserted.rows[0].id;
    if (plantId) {
      await refreshPlantSummary(plantId).catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("[plant-health] plant summary refresh failed:", error?.message || error);
      });
    }
    const row = await loadOwnedScan(userId, scanId);
    res.status(201).json({ scan: scanFromRow(row) });
  } catch (error) {
    // eslint-disable-next-line no-console
    if (!error?.status) console.warn("[plant-health] scan failed:", error?.message || error);
    sendError(res, error, "Could not analyse the plant. Please try again.");
  }
});

router.post("/v1/plant-health/scans/:id/assign", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const userId = req.user.userId;
    const scanId = parseId(req.params.id);
    const scan = scanId ? await loadOwnedScan(userId, scanId) : null;
    if (!scan) {
      res.status(404).json({ message: "Scan not found" });
      return;
    }

    let plant = null;
    const plantId = parseId(req.body?.plantId);
    if (plantId) {
      plant = await loadOwnedPlant(userId, plantId);
      if (!plant) {
        res.status(404).json({ message: "Plant not found" });
        return;
      }
    } else {
      const input = readPlantInput(req.body?.newPlant || {});
      if (!input.name) {
        res.status(400).json({ message: "Choose a plant or enter a name" });
        return;
      }
      plant = await createPlant(userId, input);
    }

    const previousPlantId = scan.plantId;
    await query(`UPDATE plant_health_scans SET plant_id = $1 WHERE id = $2 AND user_id = $3`, [plant.id, scanId, userId]);
    await refreshPlantSummary(plant.id);
    if (previousPlantId && previousPlantId !== plant.id) await refreshPlantSummary(previousPlantId);
    res.json({
      scan: scanFromRow(await loadOwnedScan(userId, scanId)),
      plant: await loadOwnedPlant(userId, plant.id)
    });
  } catch (error) {
    sendError(res, error, "Could not save the scan to this plant");
  }
});

router.delete("/v1/plant-health/scans/:id", authRequired, async (req, res) => {
  try {
    await ensurePlantHealthTables();
    const scanId = parseId(req.params.id);
    const scan = scanId ? await loadOwnedScan(req.user.userId, scanId) : null;
    if (!scan) {
      res.status(404).json({ message: "Scan not found" });
      return;
    }
    await query(`DELETE FROM plant_health_scans WHERE id = $1 AND user_id = $2`, [scanId, req.user.userId]);
    if (scan.plantId) await refreshPlantSummary(scan.plantId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error, "Could not delete the scan");
  }
});

module.exports = router;
