/**
 * Upsert the Cropvibe admin login account.
 *
 * Usage (from backend/):
 *   node scripts/ensure-admin.js
 *
 * Env overrides:
 *   ADMIN_EMAIL=info@cropvibe.com
 *   ADMIN_PASSWORD=Cropvibe@2026
 *   ADMIN_FULL_NAME=Cropvibe Admin
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { query } = require("../src/db");

async function ensureAdminUser(options = {}) {
  const email = String(options.email || process.env.ADMIN_EMAIL || "info@cropvibe.com")
    .trim()
    .toLowerCase();
  const password = String(options.password || process.env.ADMIN_PASSWORD || "Cropvibe@2026");
  const fullName = String(options.fullName || process.env.ADMIN_FULL_NAME || "Cropvibe Admin").trim();

  if (!email || password.length < 6) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD (min 6 chars) are required");
  }

  await query(
    `
    CREATE TABLE IF NOT EXISTS learn_users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE`);
  await query(`ALTER TABLE learn_users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE`);

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `
    INSERT INTO learn_users (email, password_hash, full_name, role)
    VALUES ($1, $2, $3, 'admin')
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          role = 'admin'
    RETURNING id, email, full_name AS "fullName", role
    `,
    [email, passwordHash, fullName]
  );

  return result.rows[0];
}

async function main() {
  try {
    const user = await ensureAdminUser();
    console.log("Admin ready:", user);
  } catch (error) {
    console.error("Failed to ensure admin:", error.message || error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

if (require.main === module) {
  void main();
}

module.exports = { ensureAdminUser };
