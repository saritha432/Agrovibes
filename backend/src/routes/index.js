const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { query } = require("../db");
const bcrypt = require("bcryptjs");
const { signJwt, authOptional, authRequired, requireRole } = require("../auth");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const router = express.Router();
const hasCloudinaryConfig =
  Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
  Boolean(process.env.CLOUDINARY_API_KEY) &&
  Boolean(process.env.CLOUDINARY_API_SECRET);
if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}
const uploadsRoot = path.resolve(__dirname, "../../uploads/learn-videos");
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot),
    filename: (_req, file, cb) => {
      const safeExt = String(path.extname(file.originalname || "") || ".mp4").toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    const isVideoMime = String(file.mimetype || "").startsWith("video/");
    const isMp4Name = /\.mp4$/i.test(String(file.originalname || ""));
    if (!isVideoMime && !isMp4Name) {
      cb(new Error("Only video files are allowed"));
      return;
    }
    cb(null, true);
  }
});
let homePostsTableReady = false;
let homeStoriesTableReady = false;
let learnCoursesTableReady = false;
let learnUsersTableReady = false;
let learnEnrollmentsReady = false;
let learnProgressReady = false;

async function ensureLearnUsersTable() {
  if (learnUsersTableReady) return;
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
  learnUsersTableReady = true;
}

async function ensureLearnEnrollmentsTable() {
  if (learnEnrollmentsReady) return;
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS learn_enrollments (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      is_paid BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, course_id)
    )
    `
  );
  learnEnrollmentsReady = true;
}

async function ensureLearnProgressTable() {
  if (learnProgressReady) return;
  await ensureLearnUsersTable();
  await query(
    `
    CREATE TABLE IF NOT EXISTS learn_progress (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT false,
      last_watched_seconds INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, course_id, lesson_id)
    )
    `
  );
  learnProgressReady = true;
}

function learnFallbackCourses() {
  const sampleVideo = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  const sampleVideo2 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";
  const sampleVideo3 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4";
  return [
    {
      id: "soil-health-natural-farming",
      title: "Soil Health & Natural Farming Techniques",
      category: "Soil health",
      tags: ["Hindi", "Beginner", "Marathi"],
      level: "Beginner",
      rating: 4.9,
      learnersCount: 18200,
      durationLabel: "3h 45m",
      isFree: true,
      heroGradient: ["#f7d7c9", "#cfe7d9", "#f6d8b7"],
      instructor: {
        name: "Vijay Deshmukh",
        title: "NGO Agricultural Consultant",
        bio:
          "A seasoned agriculture expert with over a decade of hands-on experience working with Maharashtra's farmers. Known for practical, results-driven teaching methods."
      },
      syllabus: [
        { id: "1", title: "Soil Microbiology — The Invisible Workforce", durationLabel: "12:45", locked: false },
        { id: "2", title: "Composting & Organic Matter Management", durationLabel: "18:10", locked: true },
        { id: "3", title: "Green Manure Crops & Cover Cropping", durationLabel: "14:05", locked: true },
        { id: "4", title: "Natural Farming Principles — Zero Budget", durationLabel: "16:30", locked: true }
      ],
      lessons: [
        { id: "1", title: "Welcome & How to use this course", durationLabel: "03:10", locked: false, videoUrl: sampleVideo },
        { id: "2", title: "Soil Microbiology — The Invisible Workforce", durationLabel: "12:45", locked: false, videoUrl: sampleVideo2 },
        { id: "3", title: "Composting & Organic Matter Management", durationLabel: "18:10", locked: true, videoUrl: sampleVideo3 },
        { id: "4", title: "Natural Farming Principles — Zero Budget", durationLabel: "16:30", locked: true, videoUrl: sampleVideo }
      ],
      reviewsPreview: [
        {
          name: "Ganesh Pawar",
          rating: 5,
          text: "Extremely practical. I set up drip irrigation on my 2-acre farm following this course."
        },
        { name: "Meera Joshi", rating: 4, text: "Very useful in Marathi. Some modules could have more detail on soil types." },
        { name: "Sunil Wagh", rating: 5, text: "Best course for water management. Clear explanations and field examples." }
      ]
    },
    {
      id: "crop-management-basics",
      title: "Crop Management Basics",
      category: "Crop management",
      tags: ["Hindi", "Beginner"],
      level: "Beginner",
      rating: 4.7,
      learnersCount: 9800,
      durationLabel: "2h 10m",
      isFree: true,
      heroGradient: ["#f6d6c7", "#d9f3dd", "#d6e6ff"],
      instructor: {
        name: "Anita Kulkarni",
        title: "Extension Officer",
        bio: "Focused on simple, step-by-step practices for improving yields with low input cost."
      },
      syllabus: [
        { id: "1", title: "Planning Your Season", durationLabel: "10:15", locked: false },
        { id: "2", title: "Sowing & Spacing", durationLabel: "12:40", locked: true },
        { id: "3", title: "Nutrient Management", durationLabel: "14:30", locked: true }
      ],
      lessons: [
        { id: "1", title: "Planning Your Season", durationLabel: "10:15", locked: false, videoUrl: sampleVideo2 },
        { id: "2", title: "Sowing & Spacing", durationLabel: "12:40", locked: true, videoUrl: sampleVideo3 },
        { id: "3", title: "Nutrient Management", durationLabel: "14:30", locked: true, videoUrl: sampleVideo }
      ],
      reviewsPreview: [{ name: "Rohit Jadhav", rating: 5, text: "Simple and clear. Helped me plan inputs and spacing." }]
    },
    {
      id: "plant-protection-ipm",
      title: "Plant Protection: Integrated Pest Management (IPM)",
      category: "Plant care",
      tags: ["English", "Intermediate", "Hindi"],
      level: "Intermediate",
      rating: 4.8,
      learnersCount: 12600,
      durationLabel: "2h 55m",
      isFree: false,
      heroGradient: ["#e7f0ff", "#d9f3dd", "#f9e2c7"],
      instructor: {
        name: "Dr. Neha Kulkarni",
        title: "Plant Pathologist",
        bio: "Helps farmers reduce pesticide usage with practical scouting and threshold-based actions."
      },
      syllabus: [
        { id: "1", title: "Scouting & Identification", durationLabel: "11:20", locked: false },
        { id: "2", title: "Economic Thresholds", durationLabel: "13:15", locked: true },
        { id: "3", title: "Biological Controls", durationLabel: "15:40", locked: true }
      ],
      lessons: [
        { id: "1", title: "Scouting & Identification", durationLabel: "11:20", locked: false, videoUrl: sampleVideo3 },
        { id: "2", title: "Economic Thresholds", durationLabel: "13:15", locked: true, videoUrl: sampleVideo },
        { id: "3", title: "Biological Controls", durationLabel: "15:40", locked: true, videoUrl: sampleVideo2 }
      ],
      reviewsPreview: [{ name: "Anil Patil", rating: 5, text: "Very practical scouting tips and action thresholds." }]
    }
  ];
}

async function ensureLearnCoursesTable() {
  if (learnCoursesTableReady) return;
  await query(
    `
    CREATE TABLE IF NOT EXISTS learn_courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]',
      level TEXT NOT NULL,
      rating NUMERIC NOT NULL DEFAULT 0,
      learners_count INT NOT NULL DEFAULT 0,
      duration_label TEXT NOT NULL,
      is_free BOOLEAN NOT NULL DEFAULT false,
      hero_gradient JSONB NOT NULL DEFAULT '[]',
      instructor JSONB NOT NULL DEFAULT '{}',
      syllabus JSONB NOT NULL DEFAULT '[]',
      lessons JSONB NOT NULL DEFAULT '[]',
      reviews_preview JSONB NOT NULL DEFAULT '[]',
      created_by_user_id INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  // Lightweight migration for older deployments.
  await query(`ALTER TABLE learn_courses ADD COLUMN IF NOT EXISTS lessons JSONB NOT NULL DEFAULT '[]'`);
  await query(`ALTER TABLE learn_courses ADD COLUMN IF NOT EXISTS created_by_user_id INT`);
  learnCoursesTableReady = true;
}

async function seedLearnCoursesIfEmpty() {
  await ensureLearnCoursesTable();
  const countRes = await query(`SELECT COUNT(*)::INT AS count FROM learn_courses`);
  if ((countRes.rows[0]?.count || 0) > 0) return;

  const seed = learnFallbackCourses();
  for (const c of seed) {
    await query(
      `
      INSERT INTO learn_courses
        (id, title, category, tags, level, rating, learners_count, duration_label, is_free, hero_gradient, instructor, syllabus, lessons, reviews_preview)
      VALUES
        ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        c.id,
        c.title,
        c.category,
        JSON.stringify(c.tags || []),
        c.level,
        c.rating,
        c.learnersCount,
        c.durationLabel,
        c.isFree,
        JSON.stringify(c.heroGradient || []),
        JSON.stringify(c.instructor || {}),
        JSON.stringify(c.syllabus || []),
        JSON.stringify(c.lessons || []),
        JSON.stringify(c.reviewsPreview || [])
      ]
    );
  }
}

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
      video_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `
  );
  // Lightweight migration for older deployments.
  await query(`ALTER TABLE home_stories ADD COLUMN IF NOT EXISTS video_url TEXT`);
  homeStoriesTableReady = true;
}

const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname || "")}`;
      cb(null, safeName);
    }
  }),
  limits: {
    fileSize: 60 * 1024 * 1024 // 60MB
  }
});

router.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", db: "disconnected", message: error.message });
  }
});

router.post("/v1/uploads/video", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "file is required" });
      return;
    }
    // Note: when deployed behind a proxy, rely on x-forwarded-proto/host.
    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").toString();
    const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
    const publicUrl = `${proto}://${host}/uploads/${req.file.filename}`;
    res.status(201).json({ url: publicUrl });
  } catch (error) {
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

router.post("/v1/media/cloudinary-sign", async (req, res) => {
  try {
    const { folder = "agrovibes" } = req.body || {};
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      res.status(500).json({ message: "Cloudinary env vars missing" });
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary signature: sort params, then sha1(paramString + api_secret)
    const params = { folder: String(folder), timestamp };
    const paramString = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const signature = crypto.createHash("sha1").update(`${paramString}${apiSecret}`).digest("hex");

    res.json({
      cloudName,
      apiKey,
      timestamp,
      folder: params.folder,
      signature
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to sign upload", error: error.message });
  }
});

router.get("/v1/bootstrap", (_req, res) => {
  res.json({
    app: "Agrovibes",
    modules: ["home", "marketplace", "create", "services", "community", "profile", "wallet", "escrow"]
  });
});

router.post("/v1/auth/register", async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const { email, password, fullName, role } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const safeRole = ["student", "instructor", "admin"].includes(String(role)) ? String(role) : "student";

    if (!normalizedEmail || !password || String(password).length < 6 || !fullName) {
      res.status(400).json({ message: "email, fullName and password (min 6 chars) are required" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await query(
      `
      INSERT INTO learn_users (email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, full_name AS "fullName", role
      `,
      [normalizedEmail, passwordHash, String(fullName).trim(), safeRole]
    );

    const user = result.rows[0];
    const token = signJwt({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName });
    res.status(201).json({ token, user });
  } catch (error) {
    const msg = String(error.message || "");
    if (msg.includes("duplicate key") || msg.includes("already exists") || msg.includes("unique")) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }
    res.status(500).json({ message: "Failed to register", error: error.message });
  }
});

router.post("/v1/auth/login", async (req, res) => {
  try {
    await ensureLearnUsersTable();
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      res.status(400).json({ message: "email and password are required" });
      return;
    }

    const result = await query(
      `
      SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName", role
      FROM learn_users
      WHERE email = $1
      LIMIT 1
      `,
      [normalizedEmail]
    );
    const userRow = result.rows[0];
    if (!userRow) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    const ok = await bcrypt.compare(String(password), String(userRow.passwordHash));
    if (!ok) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const user = { id: userRow.id, email: userRow.email, fullName: userRow.fullName, role: userRow.role };
    const token = signJwt({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName });
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: "Failed to login", error: error.message });
  }
});

router.get("/v1/auth/me", authRequired, async (req, res) => {
  res.json({ user: req.user });
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
        viewed,
        video_url AS "videoUrl"
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
    res.json({
      stories: [
        { id: 1, userName: "You", district: "Nashik", avatarLabel: "Y", hasNew: false, viewed: true },
        { id: 2, userName: "Ramesh", district: "Nashik", avatarLabel: "R", hasNew: true, viewed: false }
      ],
      source: "fallback",
      message: error.message
    });
  }
});

router.post("/v1/home/stories", async (req, res) => {
  try {
    await ensureHomeStoriesTable();
    const { userName, district, videoUrl } = req.body || {};
    if (!userName || !district) {
      res.status(400).json({ message: "userName and district are required" });
      return;
    }

    const avatarLabel = String(userName).trim().charAt(0).toUpperCase() || "U";
    const result = await query(
      `
      INSERT INTO home_stories (user_name, district, avatar_label, has_new, viewed, video_url)
      VALUES ($1, $2, $3, true, false, $4)
      RETURNING
        id,
        user_name AS "userName",
        district,
        avatar_label AS "avatarLabel",
        has_new AS "hasNew",
        viewed,
        video_url AS "videoUrl"
      `,
      [userName, district, avatarLabel, videoUrl || null]
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

    // If there are no posts yet, return an empty list.
    // The mobile app should only attempt playback when a real uploaded URL exists.
    if (result.rows.length === 0) {
      res.json({ posts: [] });
      return;
    }

    res.json({ posts: result.rows });
  } catch (error) {
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
      ],
      source: "fallback",
      message: error.message
    });
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

router.get("/v1/learn/courses", async (_req, res) => {
  try {
    await seedLearnCoursesIfEmpty();
    const result = await query(
      `
      SELECT
        id,
        title,
        category,
        tags,
        level,
        rating::FLOAT AS rating,
        learners_count AS "learnersCount",
        duration_label AS "durationLabel",
        is_free AS "isFree",
        hero_gradient AS "heroGradient",
        instructor,
        syllabus,
        lessons,
        reviews_preview AS "reviewsPreview",
        updated_at AS "updatedAt"
      FROM learn_courses
      ORDER BY updated_at DESC
      `
    );
    res.json({ courses: result.rows, source: "db" });
  } catch (error) {
    res.json({ courses: learnFallbackCourses(), source: "fallback", message: error.message });
  }
});

router.post("/v1/learn/videos/upload", authRequired, requireRole(["instructor", "admin"]), (req, res) => {
  videoUpload.single("video")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ message: err.message || "Video upload failed" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "video file is required" });
      return;
    }
    try {
      if (hasCloudinaryConfig) {
        const uploaded = await cloudinary.uploader.upload(req.file.path, {
          resource_type: "video",
          folder: "agrovibes/learn-videos",
          use_filename: true,
          unique_filename: true,
          overwrite: false
        });
        try {
          fs.unlinkSync(req.file.path);
        } catch (_e) {
          // ignore local cleanup failures
        }
        res.status(201).json({
          videoUrl: uploaded.secure_url,
          fileName: uploaded.public_id,
          size: req.file.size,
          provider: "cloudinary"
        });
        return;
      }

      const explicitBaseUrl = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
      const origin = explicitBaseUrl || `${req.protocol}://${req.get("host")}`;
      const videoUrl = `${origin}/uploads/learn-videos/${encodeURIComponent(req.file.filename)}`;
      res.status(201).json({ videoUrl, fileName: req.file.filename, size: req.file.size, provider: "local" });
    } catch (uploadError) {
      res.status(500).json({ message: "Video upload failed", error: uploadError.message || String(uploadError) });
    }
  });
});

router.post("/v1/learn/courses", authRequired, requireRole(["instructor", "admin"]), async (req, res) => {
  try {
    await ensureLearnCoursesTable();
    const payload = req.body || {};
    const id = String(payload.id || "").trim();
    const title = String(payload.title || "").trim();
    const category = String(payload.category || "").trim() || "General";
    const tags = Array.isArray(payload.tags) ? payload.tags.map(String) : [];
    const level = String(payload.level || "Beginner");
    const rating = Number(payload.rating || 0);
    const learnersCount = Number(payload.learnersCount || 0);
    const durationLabel = String(payload.durationLabel || "0m");
    const isFree = Boolean(payload.isFree ?? true);
    const heroGradient = Array.isArray(payload.heroGradient) ? payload.heroGradient.map(String) : ["#f7d7c9", "#cfe7d9", "#f6d8b7"];
    const instructor = payload.instructor && typeof payload.instructor === "object" ? payload.instructor : { name: req.user.fullName, title: "Instructor", bio: "" };
    const syllabus = Array.isArray(payload.syllabus) ? payload.syllabus : [];
    const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
    const reviewsPreview = Array.isArray(payload.reviewsPreview) ? payload.reviewsPreview : [];

    if (!id || !title) {
      res.status(400).json({ message: "id and title are required" });
      return;
    }

    const isProbablyPlayableLessonUrl = (url) => {
      const u = String(url || "").trim().toLowerCase();
      const isHttp = u.startsWith("http://") || u.startsWith("https://");
      return isHttp && (/\.mp4(\?|#|$)/.test(u) || u.includes("/uploads/learn-videos/"));
    };

    if (lessons.length > 0) {
      for (const l of lessons) {
        const videoUrl = l?.videoUrl;
        if (!isProbablyPlayableLessonUrl(videoUrl)) {
          res.status(400).json({
            message: "Lesson videoUrl must be a direct video URL."
          });
          return;
        }
      }
    }

    const result = await query(
      `
      INSERT INTO learn_courses
        (id, title, category, tags, level, rating, learners_count, duration_label, is_free, hero_gradient, instructor, syllabus, lessons, reviews_preview, created_by_user_id, updated_at)
      VALUES
        ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,NOW())
      RETURNING id
      `,
      [
        id,
        title,
        category,
        JSON.stringify(tags),
        level,
        rating,
        learnersCount,
        durationLabel,
        isFree,
        JSON.stringify(heroGradient),
        JSON.stringify(instructor),
        JSON.stringify(syllabus),
        JSON.stringify(lessons),
        JSON.stringify(reviewsPreview),
        req.user.userId
      ]
    );

    res.status(201).json({ courseId: result.rows[0].id });
  } catch (error) {
    const msg = String(error.message || "");
    if (msg.includes("duplicate key") || msg.includes("already exists") || msg.includes("unique")) {
      res.status(409).json({ message: "Course id already exists" });
      return;
    }
    res.status(500).json({ message: "Failed to create course", error: error.message });
  }
});

router.put("/v1/learn/courses/:id", authRequired, requireRole(["instructor", "admin"]), async (req, res) => {
  try {
    await ensureLearnCoursesTable();
    const id = String(req.params.id || "");
    const payload = req.body || {};

    const patch = {
      title: payload.title,
      category: payload.category,
      tags: payload.tags,
      level: payload.level,
      rating: payload.rating,
      learnersCount: payload.learnersCount,
      durationLabel: payload.durationLabel,
      isFree: payload.isFree,
      heroGradient: payload.heroGradient,
      instructor: payload.instructor,
      syllabus: payload.syllabus,
      lessons: payload.lessons,
      reviewsPreview: payload.reviewsPreview
    };

    const isProbablyPlayableLessonUrl = (url) => {
      const u = String(url || "").trim().toLowerCase();
      const isHttp = u.startsWith("http://") || u.startsWith("https://");
      return isHttp && (/\.mp4(\?|#|$)/.test(u) || u.includes("/uploads/learn-videos/"));
    };

    if (Array.isArray(patch.lessons)) {
      for (const l of patch.lessons) {
        const videoUrl = l?.videoUrl;
        if (!isProbablyPlayableLessonUrl(videoUrl)) {
          res.status(400).json({ message: "Lesson videoUrl must be a direct video URL" });
          return;
        }
      }
    }

    // Fetch current for ownership check if instructor (admin can edit all)
    if (req.user.role !== "admin") {
      const ownerRes = await query(`SELECT created_by_user_id AS "createdByUserId" FROM learn_courses WHERE id = $1 LIMIT 1`, [id]);
      const owner = ownerRes.rows[0];
      if (!owner) {
        res.status(404).json({ message: "Course not found" });
        return;
      }
      if (owner.createdByUserId && Number(owner.createdByUserId) !== Number(req.user.userId)) {
        res.status(403).json({ message: "You can only edit your own courses" });
        return;
      }
    }

    const current = await query(`SELECT * FROM learn_courses WHERE id = $1 LIMIT 1`, [id]);
    if (!current.rows[0]) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const merged = {
      id,
      title: String(patch.title ?? current.rows[0].title),
      category: String(patch.category ?? current.rows[0].category),
      tags: Array.isArray(patch.tags) ? patch.tags.map(String) : current.rows[0].tags,
      level: String(patch.level ?? current.rows[0].level),
      rating: Number(patch.rating ?? current.rows[0].rating),
      learnersCount: Number(patch.learnersCount ?? current.rows[0].learners_count ?? current.rows[0].learnersCount ?? 0),
      durationLabel: String(patch.durationLabel ?? current.rows[0].duration_label ?? current.rows[0].durationLabel),
      isFree: Boolean(patch.isFree ?? current.rows[0].is_free ?? current.rows[0].isFree),
      heroGradient: Array.isArray(patch.heroGradient) ? patch.heroGradient.map(String) : current.rows[0].hero_gradient,
      instructor: patch.instructor && typeof patch.instructor === "object" ? patch.instructor : current.rows[0].instructor,
      syllabus: Array.isArray(patch.syllabus) ? patch.syllabus : current.rows[0].syllabus,
      lessons: Array.isArray(patch.lessons) ? patch.lessons : current.rows[0].lessons,
      reviewsPreview: Array.isArray(patch.reviewsPreview) ? patch.reviewsPreview : current.rows[0].reviews_preview
    };

    await query(
      `
      UPDATE learn_courses
      SET
        title = $2,
        category = $3,
        tags = $4::jsonb,
        level = $5,
        rating = $6,
        learners_count = $7,
        duration_label = $8,
        is_free = $9,
        hero_gradient = $10::jsonb,
        instructor = $11::jsonb,
        syllabus = $12::jsonb,
        lessons = $13::jsonb,
        reviews_preview = $14::jsonb,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        merged.id,
        merged.title,
        merged.category,
        JSON.stringify(merged.tags || []),
        merged.level,
        merged.rating,
        merged.learnersCount,
        merged.durationLabel,
        merged.isFree,
        JSON.stringify(merged.heroGradient || []),
        JSON.stringify(merged.instructor || {}),
        JSON.stringify(merged.syllabus || []),
        JSON.stringify(merged.lessons || []),
        JSON.stringify(merged.reviewsPreview || [])
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to update course", error: error.message });
  }
});

router.post("/v1/learn/courses/:id/enroll", authRequired, async (req, res) => {
  try {
    await seedLearnCoursesIfEmpty();
    await ensureLearnEnrollmentsTable();

    const courseId = String(req.params.id || "");
    const courseRes = await query(`SELECT is_free AS "isFree" FROM learn_courses WHERE id = $1 LIMIT 1`, [courseId]);
    if (!courseRes.rows[0]) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const { paid } = req.body || {};
    const isFree = Boolean(courseRes.rows[0].isFree);
    const isPaid = Boolean(paid) || isFree;

    const result = await query(
      `
      INSERT INTO learn_enrollments (user_id, course_id, status, is_paid)
      VALUES ($1, $2, 'active', $3)
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET status='active', is_paid = (learn_enrollments.is_paid OR EXCLUDED.is_paid)
      RETURNING id, course_id AS "courseId", status, is_paid AS "isPaid"
      `,
      [req.user.userId, courseId, isPaid]
    );

    res.status(201).json({ enrollment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to enroll", error: error.message });
  }
});

router.get("/v1/learn/courses/:id/progress", authRequired, async (req, res) => {
  try {
    await ensureLearnProgressTable();
    const courseId = String(req.params.id || "");
    const rows = await query(
      `
      SELECT lesson_id AS "lessonId", completed, last_watched_seconds AS "lastWatchedSeconds", updated_at AS "updatedAt"
      FROM learn_progress
      WHERE user_id=$1 AND course_id=$2
      ORDER BY updated_at DESC
      `,
      [req.user.userId, courseId]
    );
    res.json({ progress: rows.rows });
  } catch (error) {
    res.status(500).json({ message: "Failed to load progress", error: error.message });
  }
});

router.post("/v1/learn/courses/:id/progress", authRequired, async (req, res) => {
  try {
    await ensureLearnProgressTable();
    const courseId = String(req.params.id || "");
    const { lessonId, completed, lastWatchedSeconds } = req.body || {};
    if (!lessonId) {
      res.status(400).json({ message: "lessonId is required" });
      return;
    }
    const result = await query(
      `
      INSERT INTO learn_progress (user_id, course_id, lesson_id, completed, last_watched_seconds, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (user_id, course_id, lesson_id)
      DO UPDATE SET completed=EXCLUDED.completed, last_watched_seconds=EXCLUDED.last_watched_seconds, updated_at=NOW()
      RETURNING lesson_id AS "lessonId", completed, last_watched_seconds AS "lastWatchedSeconds", updated_at AS "updatedAt"
      `,
      [req.user.userId, courseId, String(lessonId), Boolean(completed), Number(lastWatchedSeconds || 0)]
    );
    res.status(201).json({ progress: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to save progress", error: error.message });
  }
});

router.get("/v1/learn/courses/:id", authOptional, async (req, res) => {
  try {
    await seedLearnCoursesIfEmpty();
    const id = String(req.params.id || "");
    const result = await query(
      `
      SELECT
        id,
        title,
        category,
        tags,
        level,
        rating::FLOAT AS rating,
        learners_count AS "learnersCount",
        duration_label AS "durationLabel",
        is_free AS "isFree",
        hero_gradient AS "heroGradient",
        instructor,
        syllabus,
        lessons,
        reviews_preview AS "reviewsPreview",
        updated_at AS "updatedAt"
      FROM learn_courses
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    const course = result.rows[0];
    // Entitlements: locked lessons playable only if enrolled+paid or course is free.
    let canAccessLocked = false;
    if (course.isFree) {
      canAccessLocked = true;
    } else if (req.user?.userId) {
      try {
        await ensureLearnEnrollmentsTable();
        const enr = await query(
          `SELECT is_paid AS "isPaid", status FROM learn_enrollments WHERE user_id=$1 AND course_id=$2 LIMIT 1`,
          [req.user.userId, id]
        );
        canAccessLocked = Boolean(enr.rows[0] && enr.rows[0].status === "active" && enr.rows[0].isPaid);
      } catch (_e) {
        canAccessLocked = false;
      }
    }

    if (Array.isArray(course.lessons)) {
      course.lessons = course.lessons.map((l) => {
        const baseLocked = Boolean(l.locked);
        if (!baseLocked) return l;
        // locked lesson: keep it locked; player screen uses canAccessLocked for enabling playback
        return { ...l, locked: !canAccessLocked };
      });
    }

    res.json({ course, source: "db", canAccessLocked });
  } catch (error) {
    const fallback = learnFallbackCourses().find((c) => c.id === req.params.id);
    if (!fallback) {
      res.status(404).json({ message: "Course not found", source: "fallback", error: error.message });
      return;
    }
    res.json({ course: fallback, source: "fallback", message: error.message });
  }
});

module.exports = router;
