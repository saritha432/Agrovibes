const { Pool } = require("pg");
const { newDb } = require("pg-mem");

const connectionString = (process.env.DATABASE_URL || "").trim();

if (process.env.DATABASE_URL_REQUIRED === "true" && !connectionString) {
  throw new Error(
    "DATABASE_URL is required (DATABASE_URL_REQUIRED=true) but DATABASE_URL is empty. " +
      "Use PostgreSQL: set DATABASE_URL, e.g. postgres://postgres:postgres@localhost:5432/agrovibes " +
      "and start Postgres (see docker-compose.yml in the repo root)."
  );
}

let pool = null;
let mem = null;

if (connectionString) {
  pool = new Pool({ connectionString });
  // eslint-disable-next-line no-console
  console.log("[db] Using PostgreSQL");
} else {
  // Dev-friendly fallback: in-memory Postgres when DATABASE_URL isn't set.
  // eslint-disable-next-line no-console
  console.warn(
    "[db] DATABASE_URL not set; using in-memory PostgreSQL (pg-mem). Data is not persisted. " +
      "For real Postgres: run `docker compose up -d` from the repo root and set DATABASE_URL in backend/.env."
  );
  mem = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = mem.adapters.createPg();
  pool = new adapter.Pool();
}

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  mem,
  query
};
