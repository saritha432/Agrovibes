const { query } = require("./db");
const { loadForecast, significantWeatherAlert } = require("./weather");
const { sendSocialPushToUser } = require("./pushNotifications");

const DEFAULT_INTERVAL_MS = 3 * 60 * 60 * 1000;
const DEDUPE_MS = 18 * 60 * 60 * 1000;
const MAX_USERS = 400;

let timer = null;
let running = false;
let tableReady = false;

async function ensureWeatherAlertStateTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS social_notifications (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      actor_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      follow_id INT,
      type TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS comment_excerpt TEXT`);
  await query(`ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS post_id INT`);
  await query(`
    CREATE TABLE IF NOT EXISTS weather_alert_state (
      user_id INT PRIMARY KEY REFERENCES learn_users(id) ON DELETE CASCADE,
      alert_key TEXT NOT NULL,
      notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

async function listUsersWithLocation() {
  const result = await query(
    `
    SELECT
      id,
      location_lat AS lat,
      location_lng AS lng,
      COALESCE(NULLIF(TRIM(location_label), ''), '') AS label
    FROM learn_users
    WHERE location_lat IS NOT NULL
      AND location_lng IS NOT NULL
      AND ABS(location_lat) >= 0.05
      AND ABS(location_lng) >= 0.05
    ORDER BY id ASC
    LIMIT $1
    `,
    [MAX_USERS]
  );
  return result.rows || [];
}

async function notifyUser(user, alert) {
  const userId = Number(user.id);
  const excerpt = String(alert.body || "").slice(0, 280);
  await query(
    `
    INSERT INTO social_notifications (user_id, actor_id, follow_id, type, is_read, post_id, comment_excerpt)
    VALUES ($1, $1, NULL, 'weather_alert', false, NULL, $2)
    `,
    [userId, excerpt]
  );
  await sendSocialPushToUser({
    userId,
    type: "weather_alert",
    actorName: "Weather",
    actorId: userId,
    commentExcerpt: excerpt
  });
  await query(
    `
    INSERT INTO weather_alert_state (user_id, alert_key, notified_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET alert_key = EXCLUDED.alert_key,
          notified_at = NOW()
    `,
    [userId, alert.key]
  );
}

async function runWeatherAlertTick() {
  if (running) return;
  running = true;
  try {
    await ensureWeatherAlertStateTable();
    const users = await listUsersWithLocation();
    const forecastByPlace = new Map();
    for (const user of users) {
      const placeKey = `${Number(user.lat).toFixed(2)},${Number(user.lng).toFixed(2)}`;
      let report = forecastByPlace.get(placeKey);
      if (!report) {
        try {
          report = await loadForecast({
            label: user.label || placeKey,
            district: user.label || "Selected location",
            lat: Number(user.lat),
            lng: Number(user.lng)
          });
        } catch (error) {
          console.warn("[weather-alerts] forecast failed", placeKey, error?.message || error);
          continue;
        }
        forecastByPlace.set(placeKey, report);
      }
      const alert = significantWeatherAlert(report);
      if (!alert) continue;
      const prior = await query(
        `SELECT alert_key AS "alertKey", notified_at AS "notifiedAt" FROM weather_alert_state WHERE user_id = $1 LIMIT 1`,
        [user.id]
      );
      const last = prior.rows[0];
      if (last?.alertKey === alert.key) {
        const notifiedAt = Date.parse(String(last.notifiedAt || ""));
        if (Number.isFinite(notifiedAt) && Date.now() - notifiedAt < DEDUPE_MS) continue;
      }
      try {
        await notifyUser(user, alert);
      } catch (error) {
        console.warn("[weather-alerts] notify failed", user.id, error?.message || error);
      }
    }
  } catch (error) {
    console.warn("[weather-alerts] tick failed:", error?.message || error);
  } finally {
    running = false;
  }
}

function startWeatherAlertPolling() {
  if (String(process.env.WEATHER_ALERTS_ENABLED || "true").toLowerCase() === "false") {
    return;
  }
  if (timer) return;
  const intervalMs = Math.max(15 * 60 * 1000, Number(process.env.WEATHER_ALERT_INTERVAL_MS || DEFAULT_INTERVAL_MS) || DEFAULT_INTERVAL_MS);
  setTimeout(() => {
    void runWeatherAlertTick();
  }, 20 * 1000);
  timer = setInterval(() => {
    void runWeatherAlertTick();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
}

module.exports = {
  startWeatherAlertPolling,
  runWeatherAlertTick
};
