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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Public CDN base for playback URLs (CloudFront or custom domain).
 * Set AWS_CLOUDFRONT_DOMAIN=d1234.cloudfront.net or AWS_S3_PUBLIC_BASE_URL=https://d1234.cloudfront.net
 */
function getPublicCdnBaseUrl() {
  const cloudFrontDomain = stripEnv(process.env.AWS_CLOUDFRONT_DOMAIN);
  if (cloudFrontDomain) {
    const host = cloudFrontDomain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return host ? `https://${host}` : "";
  }
  return stripEnv(process.env.AWS_S3_PUBLIC_BASE_URL).replace(/\/+$/, "");
}

function isCloudFrontConfigured() {
  return Boolean(getPublicCdnBaseUrl());
}

function buildS3OriginBaseUrl() {
  const cfg = readS3StorageConfig();
  if (!cfg) {
    throw new Error("AWS S3 is not configured");
  }
  return cfg.region === "us-east-1"
    ? `https://${cfg.bucket}.s3.amazonaws.com`
    : `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
}

function s3UrlPatternsForBucket(cfg) {
  const bucket = escapeRegExp(cfg.bucket);
  const region = escapeRegExp(cfg.region);
  return [
    new RegExp(`^https://${bucket}\\.s3\\.${region}\\.amazonaws\\.com/(.+)$`, "i"),
    new RegExp(`^https://${bucket}\\.s3\\.amazonaws\\.com/(.+)$`, "i"),
    new RegExp(`^https://s3\\.${region}\\.amazonaws\\.com/${bucket}/(.+)$`, "i"),
    new RegExp(`^https://s3\\.amazonaws\\.com/${bucket}/(.+)$`, "i")
  ];
}

function extractS3ObjectKeyFromUrl(url) {
  const cfg = readS3StorageConfig();
  if (!cfg) return null;
  const input = String(url || "").trim();
  if (!input) return null;
  for (const pattern of s3UrlPatternsForBucket(cfg)) {
    const match = input.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  const cdnBase = getPublicCdnBaseUrl();
  if (cdnBase && input.startsWith(`${cdnBase}/`)) {
    return decodeURIComponent(input.slice(cdnBase.length + 1));
  }
  return null;
}

/** Rewrite direct S3 object URLs to CloudFront when configured. */
function rewriteS3ObjectUrlToPublicCdn(url) {
  const cdnBase = getPublicCdnBaseUrl();
  if (!cdnBase || url == null) return url;
  const input = String(url).trim();
  if (!input) return url;
  if (input.startsWith(`${cdnBase}/`) || input === cdnBase) return input;
  const objectKey = extractS3ObjectKeyFromUrl(input);
  if (!objectKey) return url;
  return `${cdnBase}/${objectKey}`;
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
  const cdnBase = getPublicCdnBaseUrl();
  if (cdnBase) {
    return key ? `${cdnBase}/${key}` : cdnBase;
  }
  const origin = buildS3OriginBaseUrl();
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
    const cdnBase = getPublicCdnBaseUrl();
    return {
      ok: true,
      configured: true,
      bucket: cfg.bucket,
      region: cfg.region,
      cloudFrontConfigured: Boolean(cdnBase),
      cloudFrontDomain: cdnBase ? cdnBase.replace(/^https?:\/\//i, "") : null,
      publicBaseUrl: cdnBase || buildS3PublicUrl(""),
      s3OriginUrl: buildS3OriginBaseUrl(),
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
  getPublicCdnBaseUrl,
  isCloudFrontConfigured,
  buildS3PublicUrl,
  rewriteS3ObjectUrlToPublicCdn,
  uploadBufferToS3,
  checkS3StorageHealth
};
