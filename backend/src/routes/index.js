const express = require("express");
const { query } = require("../db");

const router = express.Router();

router.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", db: "disconnected", message: error.message });
  }
});

router.get("/v1/bootstrap", (_req, res) => {
  res.json({
    app: "Agrovibes",
    modules: ["home", "marketplace", "create", "services", "community", "profile", "wallet", "escrow"]
  });
});

router.get("/v1/marketplace/listings", async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT
        l.id,
        l.crop_name AS "cropName",
        COALESCE(d.name, 'Unknown') AS district,
        l.price_per_kg AS "pricePerKg",
        l.verified_only AS "verifiedOnly"
      FROM listings l
      LEFT JOIN districts d ON d.id = l.district_id
      ORDER BY l.created_at DESC
      LIMIT 30
      `
    );

    res.json({ listings: result.rows });
  } catch (error) {
    res.json({
      listings: [
        { id: 1, cropName: "Tomato", district: "Nashik", pricePerKg: 28, verifiedOnly: true },
        { id: 2, cropName: "Onion", district: "Nagpur", pricePerKg: 25, verifiedOnly: true },
        { id: 3, cropName: "Soybean", district: "Indore", pricePerKg: 42, verifiedOnly: false }
      ],
      source: "fallback",
      message: error.message
    });
  }
});

router.get("/v1/community/questions", async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT
        q.id,
        u.full_name AS "userName",
        COALESCE(d.name, 'Unknown') AS district,
        q.text_content AS "textContent",
        q.created_at AS "createdAt",
        COALESCE(SUM(a.upvotes), 0)::INT AS upvotes,
        COALESCE(COUNT(a.id), 0)::INT AS "answersCount",
        COALESCE(BOOL_OR(a.is_resolved), false) AS "isResolved"
      FROM community_questions q
      JOIN users u ON u.id = q.user_id
      LEFT JOIN districts d ON d.id = q.district_id
      LEFT JOIN community_answers a ON a.question_id = q.id
      GROUP BY q.id, u.full_name, d.name
      ORDER BY q.created_at DESC
      LIMIT 30
      `
    );

    res.json({ questions: result.rows });
  } catch (error) {
    res.json({
      questions: [
        {
          id: 1,
          userName: "Mahesh Rao",
          district: "Nagpur",
          textContent: "The leaves on my orange trees are turning yellow. Any remedy?",
          upvotes: 45,
          answersCount: 2,
          isResolved: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          userName: "Pradeep Kumar",
          district: "Indore",
          textContent: "Heavy whitefly infestation on soybean. How to control organically?",
          upvotes: 21,
          answersCount: 3,
          isResolved: false,
          createdAt: new Date().toISOString()
        }
      ],
      source: "fallback",
      message: error.message
    });
  }
});

module.exports = router;
