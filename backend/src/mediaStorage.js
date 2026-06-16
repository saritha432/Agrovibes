const { isS3StorageConfigured, uploadBufferToS3, checkS3StorageHealth } = require("./s3Storage");
const { isSupabaseStorageConfigured, uploadBufferToSupabase, checkSupabaseStorageHealth } = require("./supabaseStorage");

function getMediaStorageProvider() {
  if (isS3StorageConfigured()) return "s3";
  if (isSupabaseStorageConfigured()) return "supabase";
  return null;
}

function isMediaStorageConfigured() {
  return getMediaStorageProvider() != null;
}

/**
 * Upload media buffer. Prefers AWS S3 when configured, otherwise Supabase Storage.
 */
async function uploadMediaBuffer({ buffer, mimeType, objectPath }) {
  const provider = getMediaStorageProvider();
  if (provider === "s3") {
    const url = await uploadBufferToS3({ buffer, mimeType, objectPath });
    return { url, provider: "s3", path: objectPath };
  }
  if (provider === "supabase") {
    const url = await uploadBufferToSupabase({ buffer, mimeType, objectPath });
    return { url, provider: "supabase", path: objectPath };
  }
  throw new Error(
    "Media storage is not configured. Set AWS S3 vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET) or Supabase Storage vars."
  );
}

async function checkMediaStorageHealth() {
  const provider = getMediaStorageProvider();
  if (provider === "s3") {
    const health = await checkS3StorageHealth();
    return { provider: "s3", ...health };
  }
  if (provider === "supabase") {
    const health = await checkSupabaseStorageHealth();
    return { provider: "supabase", ...health };
  }
  return {
    provider: null,
    ok: false,
    configured: false,
    message: "No media storage provider configured"
  };
}

module.exports = {
  getMediaStorageProvider,
  isMediaStorageConfigured,
  uploadMediaBuffer,
  checkMediaStorageHealth
};
