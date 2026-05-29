const { createClient } = require("@supabase/supabase-js");

function readSupabaseStorageConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || "media").trim() || "media";
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey, bucket };
}

function isSupabaseStorageConfigured() {
  return readSupabaseStorageConfig() != null;
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

module.exports = {
  readSupabaseStorageConfig,
  isSupabaseStorageConfigured,
  uploadBufferToSupabase
};
