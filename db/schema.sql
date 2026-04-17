-- Agrovibes core schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  state_name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(140) NOT NULL,
  district_id INT REFERENCES districts(id),
  language_code VARCHAR(10) DEFAULT 'en',
  kyc_phone_verified BOOLEAN DEFAULT FALSE,
  kyc_aadhaar_verified BOOLEAN DEFAULT FALSE,
  kyc_farmer_verified BOOLEAN DEFAULT FALSE,
  reputation_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  available_balance NUMERIC(14,2) DEFAULT 0,
  escrow_balance NUMERIC(14,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  tx_type VARCHAR(40) NOT NULL, -- credit, debit, escrow_lock, escrow_release
  amount NUMERIC(14,2) NOT NULL,
  ref_type VARCHAR(40), -- order, listing, service_booking
  ref_id BIGINT,
  status VARCHAR(30) DEFAULT 'success',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_name VARCHAR(120) NOT NULL,
  quantity_kg NUMERIC(12,2) NOT NULL,
  price_per_kg NUMERIC(12,2) NOT NULL,
  grade VARCHAR(30),
  district_id INT REFERENCES districts(id),
  verified_only BOOLEAN DEFAULT FALSE,
  availability_status VARCHAR(30) DEFAULT 'available',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_media (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(20) NOT NULL, -- image, video
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reels (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id BIGINT REFERENCES listings(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL,
  title VARCHAR(200),
  description TEXT,
  visibility VARCHAR(30) DEFAULT 'public', -- public, district_only, followers_only
  duration_seconds INT NOT NULL CHECK (duration_seconds BETWEEN 3 AND 30),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  buyer_id BIGINT NOT NULL REFERENCES users(id),
  seller_id BIGINT NOT NULL REFERENCES users(id),
  listing_id BIGINT REFERENCES listings(id),
  qty_kg NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  escrow_amount NUMERIC(14,2) NOT NULL,
  order_status VARCHAR(30) DEFAULT 'created', -- created, paid, shipped, delivered, disputed, completed
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disputes (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  raised_by_user_id BIGINT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  evidence_media_url TEXT,
  evidence_voice_url TEXT,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_questions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  district_id INT REFERENCES districts(id),
  text_content TEXT NOT NULL,
  voice_url TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_answers (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES community_questions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  text_content TEXT,
  voice_url TEXT,
  upvotes INT DEFAULT 0,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  provider_id BIGINT REFERENCES users(id),
  service_type VARCHAR(30) NOT NULL, -- machinery, logistics, consultation
  district_id INT REFERENCES districts(id),
  schedule_at TIMESTAMP,
  quoted_price NUMERIC(14,2),
  advance_amount NUMERIC(14,2),
  booking_status VARCHAR(30) DEFAULT 'requested',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district_id);
CREATE INDEX IF NOT EXISTS idx_listings_crop ON listings(crop_name);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);

-- ---------------------------------------------------------------------------
-- Learn module + mobile auth (mirrors backend/src/routes/index.js DDL)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS learn_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE TABLE IF NOT EXISTS learn_enrollments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS learn_progress (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES learn_users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_watched_seconds INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id, lesson_id)
);

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
);

CREATE TABLE IF NOT EXISTS home_stories (
  id SERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  district TEXT NOT NULL,
  avatar_label TEXT NOT NULL,
  has_new BOOLEAN NOT NULL DEFAULT true,
  viewed BOOLEAN NOT NULL DEFAULT false,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learn_courses_updated ON learn_courses(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_learn_enrollments_user ON learn_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_learn_progress_user_course ON learn_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_home_posts_created ON home_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_home_stories_created ON home_stories(created_at DESC);
