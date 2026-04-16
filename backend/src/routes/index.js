const express = require("express");
const { query } = require("../db");

const router = express.Router();
let homePostsTableReady = false;
let homeStoriesTableReady = false;

async function ensureHomePostsTable() {
  if (homePostsTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_posts (
      id SERIAL PRIMARY KEY,
      user_name TEXT NOT NULL,
      location TEXT NOT NULL,
      caption TEXT NOT NULL,
      likes_count INT NOT NULL DEFAULT 0,
      comments_count INT NOT NULL DEFAULT 0,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  homePostsTableReady = true;
}

async function ensureHomeStoriesTable() {
  if (homeStoriesTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS home_stories (
      id SERIAL PRIMARY KEY,
      user_name TEXT NOT NULL,
      district TEXT NOT NULL,
      avatar_label TEXT NOT NULL,
      has_new BOOLEAN NOT NULL DEFAULT true,
      viewed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  homeStoriesTableReady = true;
}

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
        l.verified_only AS "verifiedOnly",
        'produce' AS "listingType"
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
        { id: 1, cropName: "Tomato", district: "Nashik", pricePerKg: 28, verifiedOnly: true, listingType: "produce" },
        { id: 2, cropName: "Onion", district: "Nagpur", pricePerKg: 25, verifiedOnly: true, listingType: "produce" },
        { id: 3, cropName: "Soybean", district: "Indore", pricePerKg: 42, verifiedOnly: false, listingType: "produce" }
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

router.get("/v1/home/stories", async (_req, res) => {
  try {
    await ensureHomeStoriesTable();
    const result = await query(
      `
      SELECT
        id,
        user_name AS "userName",
        district,
        avatar_label AS "avatarLabel",
        has_new AS "hasNew",
        viewed
      FROM home_stories
      ORDER BY created_at DESC
      LIMIT 40
      `
    );

    if (result.rows.length === 0) {
      res.json({
        stories: [
          { id: 1, userName: "You", district: "Nashik", avatarLabel: "Y", hasNew: false, viewed: true },
          { id: 2, userName: "Ramesh", district: "Nashik", avatarLabel: "R", hasNew: true, viewed: false },
          { id: 3, userName: "Suresh", district: "Indore", avatarLabel: "S", hasNew: true, viewed: false },
          { id: 4, userName: "Meena", district: "Ludhiana", avatarLabel: "M", hasNew: true, viewed: false },
          { id: 5, userName: "Kisan Hub", district: "Pune", avatarLabel: "K", hasNew: false, viewed: true },
          { id: 6, userName: "Agri News", district: "Delhi", avatarLabel: "A", hasNew: true, viewed: false }
        ]
      });
      return;
    }

    res.json({ stories: result.rows });
  } catch (error) {
    res.status(500).json({
      stories: [
        { id: 1, userName: "You", district: "Nashik", avatarLabel: "Y", hasNew: false, viewed: true },
        { id: 2, userName: "Ramesh", district: "Nashik", avatarLabel: "R", hasNew: true, viewed: false }
      ],
      message: error.message
    });
  }
});

router.post("/v1/home/stories", async (req, res) => {
  try {
    await ensureHomeStoriesTable();
    const { userName, district } = req.body || {};
    if (!userName || !district) {
      res.status(400).json({ message: "userName and district are required" });
      return;
    }

    const avatarLabel = String(userName).trim().charAt(0).toUpperCase() || "U";
    const result = await query(
      `
      INSERT INTO home_stories (user_name, district, avatar_label, has_new, viewed)
      VALUES ($1, $2, $3, true, false)
      RETURNING
        id,
        user_name AS "userName",
        district,
        avatar_label AS "avatarLabel",
        has_new AS "hasNew",
        viewed
      `,
      [userName, district, avatarLabel]
    );

    res.status(201).json({ story: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to create story", error: error.message });
  }
});

router.get("/v1/home/posts", async (_req, res) => {
  try {
    await ensureHomePostsTable();
    const result = await query(
      `
      SELECT
        id,
        user_name AS "userName",
        location,
        caption,
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        video_url AS "videoUrl",
        thumbnail_url AS "thumbnailUrl",
        created_at AS "createdAt"
      FROM home_posts
      ORDER BY created_at DESC
      LIMIT 50
      `
    );

    if (result.rows.length === 0) {
      res.json({
        posts: [
          {
            id: 1,
            userName: "Ramesh Patel",
            location: "Nashik",
            caption: "Fresh tomatoes available this week at Rs35/kg. Contact us now!",
            likesCount: 1284,
            commentsCount: 92,
            videoUrl: "https://example.com/video/tomato.mp4",
            thumbnailUrl: null,
            createdAt: new Date().toISOString()
          }
        ]
      });
      return;
    }

    res.json({ posts: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Failed to load home posts", error: error.message });
  }
});

router.post("/v1/home/posts", async (req, res) => {
  try {
    await ensureHomePostsTable();
    const { userName, location, caption, videoUrl, thumbnailUrl } = req.body || {};

    if (!userName || !location || !caption || !videoUrl) {
      res.status(400).json({ message: "userName, location, caption and videoUrl are required" });
      return;
    }

    const result = await query(
      `
      INSERT INTO home_posts (user_name, location, caption, video_url, thumbnail_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        user_name AS "userName",
        location,
        caption,
        likes_count AS "likesCount",
        comments_count AS "commentsCount",
        video_url AS "videoUrl",
        thumbnail_url AS "thumbnailUrl",
        created_at AS "createdAt"
      `,
      [userName, location, caption, videoUrl, thumbnailUrl || null]
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to create home post", error: error.message });
  }
});

module.exports = router;
