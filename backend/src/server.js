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
});
