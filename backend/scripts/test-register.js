require("dotenv").config();
const bcrypt = require("bcryptjs");
const { query } = require("../src/db");

async function main() {
  const email = "saritha0432@gmail.com";
  const passwordHash = await bcrypt.hash("Saritha@123", 10);
  try {
    const result = await query(
      `
      INSERT INTO learn_users (email, password_hash, full_name, role, username, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name AS "fullName", role, phone, username
      `,
      [email, passwordHash, "Saritha S", "student", "saritha-32", "+918185079563"]
    );
    console.log("INSERT OK", result.rows[0]);
  } catch (e) {
    console.log("INSERT ERR", {
      code: e.code,
      message: e.message,
      detail: e.detail,
      constraint: e.constraint
    });
  }
  process.exit(0);
}

main();
