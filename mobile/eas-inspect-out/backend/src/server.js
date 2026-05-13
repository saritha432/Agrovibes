require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 5000;
const rawCorsOrigins = process.env.CORS_ORIGIN || "";
const allowedOrigins = rawCorsOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // In some deployments (like Render) the CORS_ORIGIN list might be incomplete.
      // Prefer serving the API instead of throwing a 500 and breaking the app UI.
      // If CORS_ORIGIN is empty, treat it as "allow all".
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow wildcard.
      if (allowedOrigins.includes("*")) {
        callback(null, true);
        return;
      }

      // Allow if list is empty.
      if (allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      // Allow if explicitly listed, otherwise allow too (but CORS header will not be set in browsers
      // unless the server returns Access-Control-Allow-Origin for that origin).
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // Dev-friendly fallback: don't crash the API with a CORS error.
      callback(null, true);
    }
  })
);
app.use(
  helmet({
    // Allow media files from API origin to be played in web app origin.
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", apiRoutes);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Agrovibes backend running on port ${PORT}`);
});
