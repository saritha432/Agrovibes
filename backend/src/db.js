const { Pool } = require("pg");
const { newDb } = require("pg-mem");

const connectionString = process.env.DATABASE_URL;

let pool = null;
let mem = null;

if (connectionString) {
  pool = new Pool({ connectionString });
} else {
  // Dev-friendly fallback: in-memory Postgres when DATABASE_URL isn't set.
  // This lets local development work without provisioning Postgres.
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
