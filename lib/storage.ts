import fs from "fs";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface UploadImageObjectInput {
  /** Logical category/folder, e.g. "avatars" or "reports" */
  category: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}

export interface ObjectLocator {
  category: string;
  fileName: string;
}

export interface RetrievedImageObject {
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
}

/**
 * Resolves the root uploads directory on local disk.
 * Uses `UPLOAD_DIR` env var in containerized deployments (e.g. `/app/uploads`)
 * and defaults to `<cwd>/public/uploads` for local development.
 */
export function getUploadRootDir(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");
}

function getS3Config() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const region = process.env.AWS_REGION?.trim() || "ap-southeast-1";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    accessKeyId,
    secretAccessKey,
    region,
  };
}

export function isObjectStorageEnabled(): boolean {
  return getS3Config() !== null;
}

const globalForS3 = globalThis as unknown as {
  s3Client: S3Client | undefined;
  s3Key: string | undefined;
};

function getS3Client(): { client: S3Client; endpoint: string } | null {
  const cfg = getS3Config();
  if (!cfg) return null;

  const cacheKey = `${cfg.endpoint}|${cfg.region}|${cfg.accessKeyId}`;
  if (!globalForS3.s3Client || globalForS3.s3Key !== cacheKey) {
    globalForS3.s3Client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: true, // Required by Neon Object Storage
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    globalForS3.s3Key = cacheKey;
  }

  return { client: globalForS3.s3Client, endpoint: cfg.endpoint };
}

function normalizeCategory(rawCategory: string): string {
  return (
    rawCategory
      .replace(/^[/\\]?uploads[/\\]?/, "")
      .replace(/^[/\\]+|[/\\]+$/g, "")
      .replace(/\\/g, "/") || "reports"
  );
}

/**
 * Resolves bucket + object key for Neon Object Storage:
 * - If dedicated bucket env vars (`NEON_STORAGE_AVATARS_BUCKET` / `NEON_STORAGE_REPORTS_BUCKET`)
 *   are configured, uploads directly to that bucket with key `<fileName>`.
 * - Otherwise uploads to a single shared bucket (`NEON_STORAGE_BUCKET`, default `"uploads"`)
 *   with key `<category>/<fileName>`.
 */
function resolveBucketAndKey(
  category: string,
  fileName: string
): { bucket: string; key: string } {
  const normalized = normalizeCategory(category);

  if (normalized === "avatars" && process.env.NEON_STORAGE_AVATARS_BUCKET?.trim()) {
    return {
      bucket: process.env.NEON_STORAGE_AVATARS_BUCKET.trim(),
      key: fileName,
    };
  }

  if (normalized === "reports" && process.env.NEON_STORAGE_REPORTS_BUCKET?.trim()) {
    return {
      bucket: process.env.NEON_STORAGE_REPORTS_BUCKET.trim(),
      key: fileName,
    };
  }

  const sharedBucket = process.env.NEON_STORAGE_BUCKET?.trim() || "uploads";
  return {
    bucket: sharedBucket,
    key: `${normalized}/${fileName}`,
  };
}

/**
 * Uploads an image buffer to Neon Object Storage (S3-compatible) when
 * `AWS_ENDPOINT_URL_S3` credentials are present, or falls back to local disk
 * under `<UPLOAD_DIR>/<category>/<fileName>` in local development.
 *
 * Returns:
 * - Direct Neon public URL if `NEON_STORAGE_PUBLIC_READ=true`
 * - Same-origin `/api/uploads/<category>/<fileName>` proxy URL for private/default buckets
 * - Local `/uploads/<category>/<fileName>` in local disk mode
 */
export async function uploadImageObject(
  input: UploadImageObjectInput
): Promise<string> {
  const normalizedCategory = normalizeCategory(input.category);
  const s3 = getS3Client();

  if (s3) {
    const { bucket, key } = resolveBucketAndKey(normalizedCategory, input.fileName);

    await s3.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
      })
    );

    if (process.env.NEON_STORAGE_PUBLIC_READ === "true") {
      const publicBase =
        process.env.NEON_STORAGE_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
        s3.endpoint;
      return `${publicBase}/${bucket}/${key}`;
    }

    return `/api/uploads/${normalizedCategory}/${encodeURIComponent(input.fileName)}`;
  }

  // Local filesystem fallback (dev & tests)
  const uploadDir = path.join(
    /*turbopackIgnore: true*/ getUploadRootDir(),
    normalizedCategory
  );
  if (!fs.existsSync(/*turbopackIgnore: true*/ uploadDir)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ uploadDir, { recursive: true });
  }
  const targetPath = path.join(/*turbopackIgnore: true*/ uploadDir, input.fileName);
  fs.writeFileSync(/*turbopackIgnore: true*/ targetPath, input.buffer);

  return `/uploads/${normalizedCategory}/${input.fileName}`;
}

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/**
 * Fetches an image object from Neon Object Storage (authenticated server-side)
 * or local disk fallback. Returns `null` if not found.
 */
export async function getImageObject(
  input: ObjectLocator
): Promise<RetrievedImageObject | null> {
  const normalizedCategory = normalizeCategory(input.category);
  const defaultCache =
    normalizedCategory === "avatars"
      ? "public, max-age=3600"
      : "public, max-age=31536000, immutable";
  const s3 = getS3Client();

  if (s3) {
    const { bucket, key } = resolveBucketAndKey(normalizedCategory, input.fileName);
    try {
      const res = await s3.client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      if (!res.Body) return null;
      const body = await res.Body.transformToByteArray();
      return {
        body,
        contentType: res.ContentType || guessContentType(input.fileName),
        cacheControl: res.CacheControl || defaultCache,
      };
    } catch (err: unknown) {
      const code = (err as { name?: string; $metadata?: { httpStatusCode?: number } })?.name;
      const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (code === "NoSuchKey" || status === 404) {
        return null;
      }
      throw err;
    }
  }

  const localPath = path.join(
    /*turbopackIgnore: true*/ getUploadRootDir(),
    normalizedCategory,
    input.fileName
  );
  if (!fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
    return null;
  }

  return {
    body: new Uint8Array(fs.readFileSync(/*turbopackIgnore: true*/ localPath)),
    contentType: guessContentType(input.fileName),
    cacheControl: defaultCache,
  };
}

/**
 * Deletes an image object from Neon Object Storage or local disk.
 * Never throws if the file/object does not exist.
 */
export async function deleteImageObject(
  input: ObjectLocator
): Promise<void> {
  const normalizedCategory = normalizeCategory(input.category);
  const s3 = getS3Client();

  if (s3) {
    const { bucket, key } = resolveBucketAndKey(normalizedCategory, input.fileName);
    try {
      await s3.client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
    } catch {
      // Ignore missing/already-deleted remote object
    }
    return;
  }

  const localPath = path.join(
    /*turbopackIgnore: true*/ getUploadRootDir(),
    normalizedCategory,
    input.fileName
  );
  if (fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
    fs.unlinkSync(/*turbopackIgnore: true*/ localPath);
  }
}
