const { createClient } = require("@supabase/supabase-js");

function normalizeSupabaseUrl(raw) {
  let url = String(raw || "").trim();
  if (!url) return "";

  // Common copy-paste mistakes from Supabase dashboard / connection strings.
  url = url.replace(/^postgresql:\/\//i, "https://");
  url = url.replace(/\/(rest|storage|auth)\/v1\/?$/i, "");
  url = url.replace(/\/+$/, "");

  if (!/^https:\/\//i.test(url)) {
    throw new Error(
      'SUPABASE_URL must start with https:// (Project Settings → API → Project URL). Example: https://abcd1234.supabase.co'
    );
  }
  if (/pooler\.supabase\.com/i.test(url) || /^postgres/i.test(String(raw || "").trim())) {
    throw new Error(
      "SUPABASE_URL must be the Project URL (https://xxxx.supabase.co), not the PostgreSQL/database connection string."
    );
  }
  if (!/\.supabase\.co/i.test(url)) {
    throw new Error(
      'SUPABASE_URL must look like https://YOUR-PROJECT-REF.supabase.co (from Project Settings → API).'
    );
  }
  return url;
}

function readSupabaseStorageConfig() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
  ).trim();
  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || "media").trim() || "media";
  if (!url || !serviceRoleKey) return null;
  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be the service_role secret (eyJ...), not the publishable key (sb_publishable_...)."
    );
  }
  return { url, serviceRoleKey, bucket };
}

function isSupabaseStorageConfigured() {
  try {
    return readSupabaseStorageConfig() != null;
  } catch {
    return false;
  }
}

function getSupabaseAdmin() {
  const cfg = readSupabaseStorageConfig();
  if (!cfg) return null;
  return {
    client: createClient(cfg.url, cfg.serviceRoleKey, { auth: { persistSession: false } }),
    bucket: cfg.bucket
  };
}

/**
 * Upload a buffer to Supabase Storage and return a public URL.
 * Bucket must allow public read for mobile/web video playback.
 */
async function uploadBufferToSupabase({ buffer, mimeType, objectPath }) {
  const ctx = getSupabaseAdmin();
  if (!ctx) {
    throw new Error("Supabase Storage is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  }

  const { error } = await ctx.client.storage.from(ctx.bucket).upload(objectPath, buffer, {
    contentType: mimeType || "application/octet-stream",
    upsert: false
  });
  if (error) {
    throw new Error(error.message || "Supabase upload failed");
  }

  const { data } = ctx.client.storage.from(ctx.bucket).getPublicUrl(objectPath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) {
    throw new Error("Supabase upload succeeded but public URL is missing");
  }
  return publicUrl;
}

async function checkSupabaseStorageHealth() {
  const cfg = readSupabaseStorageConfig();
  if (!cfg) {
    return { ok: false, configured: false, message: "Supabase Storage env vars are missing" };
  }
  const ctx = getSupabaseAdmin();
  if (!ctx) {
    return { ok: false, configured: false, message: "Supabase client could not be created" };
  }
  const { data: buckets, error: listError } = await ctx.client.storage.listBuckets();
  if (listError) {
    return {
      ok: false,
      configured: true,
      bucket: cfg.bucket,
      message: listError.message || "Could not list storage buckets (check service_role key and URL)"
    };
  }
  const names = (buckets || []).map((b) => b.name);
  const bucketExists = names.includes(cfg.bucket);
  return {
    ok: bucketExists,
    configured: true,
    bucket: cfg.bucket,
    buckets: names,
    message: bucketExists
      ? "ok"
      : `Bucket "${cfg.bucket}" not found. Create a public bucket with this exact name in Supabase Storage.`
  };
}

module.exports = {
  readSupabaseStorageConfig,
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
  checkSupabaseStorageHealth
};
