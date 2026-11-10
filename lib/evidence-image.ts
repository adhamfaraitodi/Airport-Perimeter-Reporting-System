import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

export interface ProcessedEvidencePhoto {
  photoId: string;
  fileName: string;
  filePath: string;
  mimeType: "image/webp";
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface ProcessEvidenceOptions {
  subDir?: string;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Normalizes and converts uploaded evidence photos (JPEG, PNG, WebP)
 * to compressed, auto-oriented WebP format for optimal storage and fast mobile loading.
 */
export async function processAndSaveEvidencePhoto(
  base64Data: string,
  options?: ProcessEvidenceOptions
): Promise<ProcessedEvidencePhoto> {
  const photoId = crypto.randomUUID();
  const fileName = `${photoId}.webp`;
  const subDir = options?.subDir || path.join("uploads", "reports");
  const uploadDir = path.join(process.cwd(), "public", subDir);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Strip data URI prefix (e.g. data:image/png;base64,) if present
  const cleaned = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const inputBuffer = Buffer.from(cleaned, "base64");

  // Process with Sharp: auto-rotate EXIF orientation, scale down huge camera photos, compress to WebP
  let pipeline = sharp(inputBuffer).rotate();

  if (options?.maxWidth || options?.maxHeight) {
    pipeline = pipeline.resize({
      width: options.maxWidth || 1920,
      height: options.maxHeight || 1920,
      fit: "inside",
      withoutEnlargement: true,
    });
  } else {
    // Default sensible max boundary for perimeter evidence (1920px)
    pipeline = pipeline.resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const { data: outputBuffer, info } = await pipeline
    .webp({ quality: options?.quality ?? 80, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const targetPath = path.join(uploadDir, fileName);
  fs.writeFileSync(targetPath, outputBuffer);

  const relativeUrl = `/${subDir.replace(/\\/g, "/")}/${fileName}`;

  return {
    photoId,
    fileName,
    filePath: relativeUrl,
    mimeType: "image/webp",
    sizeBytes: outputBuffer.length,
    width: info.width,
    height: info.height,
  };
}
