require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const apiRoutes = require("./routes");
const { initSocketChat } = require("./socketChat");

const app = express();
const PORT = process.env.PORT || 5000;

// Authenticated JSON APIs must not be revalidated with If-None-Match.
// Express's default ETag turns the second identical GET into 304 + empty body,
// which browsers surface as a failed fetch (suggestions/search then go empty).
app.set("etag", false);

const rawCorsOrigins = process.env.CORS_ORIGIN || "";
const allowedOrigins = rawCorsOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const compression = require("compression");

app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes("*")) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, true);
    }
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (!res.get("Cache-Control")) {
      res.set("Cache-Control", "private, no-store");
    }
    return originalJson(body);
  };
  next();
});

app.use("/api", apiRoutes);

const server = http.createServer(app);
initSocketChat(server, { corsOrigins: allowedOrigins });

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cropvibe backend running on port ${PORT} (PostgreSQL + Socket.IO)`);

  // Ensure default admin login exists (info@cropvibe.com) unless disabled.
  if (String(process.env.ADMIN_ENSURE_DEFAULT || "true").toLowerCase() !== "false") {
    const { ensureAdminUser } = require("../scripts/ensure-admin");
    void ensureAdminUser()
      .then((user) => {
        // eslint-disable-next-line no-console
        console.log(`[admin] ensured ${user?.email} (role=${user?.role})`);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("[admin] ensure failed:", error?.message || error);
      });
  }

  // Poll MediaConvert HLS jobs and attach hls_url to matching home_posts when ready.
  try {
    const { isHlsTranscodeConfigured, startHlsJobPolling } = require("./hlsTranscode");
    if (isHlsTranscodeConfigured()) {
      const { query } = require("./db");
      void (async () => {
        await query(`
          CREATE TABLE IF NOT EXISTS media_hls_jobs (
            id SERIAL PRIMARY KEY,
            job_id TEXT NOT NULL UNIQUE,
            source_key TEXT NOT NULL,
            video_url TEXT NOT NULL,
            hls_url TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'SUBMITTED',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS media_hls_jobs_status_idx ON media_hls_jobs (status)`);
        await query(`CREATE INDEX IF NOT EXISTS media_hls_jobs_video_url_idx ON media_hls_jobs (video_url)`);
        await query(`ALTER TABLE home_posts ADD COLUMN IF NOT EXISTS hls_url TEXT`);
        startHlsJobPolling(query);
      })().catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("[hls] bootstrap failed:", error?.message || error);
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[hls] init skipped:", error?.message || error);
  }
});
