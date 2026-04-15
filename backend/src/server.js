require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
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
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    }
  })
);
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use("/api", apiRoutes);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Agrovibes backend running on port ${PORT}`);
});
