const { HeadBucketCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

function stripEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function readS3StorageConfig() {
  const accessKeyId = stripEnv(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = stripEnv(process.env.AWS_SECRET_ACCESS_KEY);
  const region = stripEnv(process.env.AWS_REGION);
  const bucket = stripEnv(process.env.AWS_S3_BUCKET);
  if (!accessKeyId || !secretAccessKey || !region || !bucket) return null;
  return { accessKeyId, secretAccessKey, region, bucket };
}

function isS3StorageConfigured() {
  return readS3StorageConfig() != null;
}

function getS3Client() {
  const cfg = readS3StorageConfig();
  if (!cfg) return null;
  return new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey
    }
  });
}

function buildS3PublicUrl(objectKey) {
  const cfg = readS3StorageConfig();
  if (!cfg) {
    throw new Error("AWS S3 is not configured");
  }
  const key = String(objectKey || "").replace(/^\/+/, "");
  const customBase = stripEnv(process.env.AWS_S3_PUBLIC_BASE_URL);
  if (customBase) {
    return key ? `${customBase.replace(/\/+$/, "")}/${key}` : customBase.replace(/\/+$/, "");
  }
  const origin =
    cfg.region === "us-east-1"
      ? `https://${cfg.bucket}.s3.amazonaws.com`
      : `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
  return key ? `${origin}/${key}` : origin;
}

/**
 * Upload a buffer to S3 and return a public HTTPS URL.
 * Bucket policy must allow public GetObject on agrovibes/* (see backend/.env.example).
 */
async function uploadBufferToS3({ buffer, mimeType, objectPath }) {
  const cfg = readS3StorageConfig();
  const client = getS3Client();
  if (!cfg || !client) {
    throw new Error("AWS S3 is not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET)");
  }

  const key = String(objectPath || "").replace(/^\/+/, "");
  const usePublicAcl = stripEnv(process.env.AWS_S3_PUBLIC_READ) !== "false";
  const putInput = {
    Bucket: cfg.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType || "application/octet-stream",
    CacheControl: "public, max-age=31536000, immutable"
  };
  if (usePublicAcl) {
    putInput.ACL = "public-read";
  }
  try {
    await client.send(new PutObjectCommand(putInput));
  } catch (error) {
    const msg = String(error?.message || error || "");
    if (usePublicAcl && /acl|access control/i.test(msg)) {
      throw new Error(
        `${msg}. In S3: disable Block Public ACLs, set Object Ownership to "Bucket owner preferred", or set AWS_S3_PUBLIC_READ=false and use a bucket policy on agrovibes/* instead.`
      );
    }
    throw error;
  }

  return buildS3PublicUrl(key);
}

async function checkS3StorageHealth() {
  const cfg = readS3StorageConfig();
  if (!cfg) {
    return { ok: false, configured: false, message: "AWS S3 env vars are missing" };
  }
  const client = getS3Client();
  if (!client) {
    return { ok: false, configured: false, message: "S3 client could not be created" };
  }
  try {
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return {
      ok: true,
      configured: true,
      bucket: cfg.bucket,
      region: cfg.region,
      publicBaseUrl: stripEnv(process.env.AWS_S3_PUBLIC_BASE_URL) || buildS3PublicUrl(""),
      message: "ok"
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      bucket: cfg.bucket,
      region: cfg.region,
      message: error.message || "Could not access S3 bucket (check IAM policy and bucket name)"
    };
  }
}

module.exports = {
  readS3StorageConfig,
  isS3StorageConfigured,
  buildS3PublicUrl,
  uploadBufferToS3,
  checkS3StorageHealth
};
