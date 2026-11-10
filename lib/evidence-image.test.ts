import fs from "fs";
import path from "path";
import sharp from "sharp";
import { processAndSaveEvidencePhoto } from "./evidence-image";

// Disable sharp file caching on Windows to avoid locked file handles
sharp.cache(false);

async function runTests() {
  console.log("Running evidence-image tests...");

  // 1. Create a dummy PNG image buffer for testing
  const dummyPng = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const base64DataUri = `data:image/png;base64,${dummyPng.toString("base64")}`;

  // 2. Process and save
  const result = await processAndSaveEvidencePhoto(base64DataUri);

  // Assertions
  if (!result.photoId) {
    throw new Error("Expected photoId to be generated");
  }
  if (!result.fileName.endsWith(".webp")) {
    throw new Error(`Expected fileName to end with .webp, got ${result.fileName}`);
  }
  if (result.mimeType !== "image/webp") {
    throw new Error(`Expected mimeType to be image/webp, got ${result.mimeType}`);
  }
  if (!result.filePath.startsWith("/uploads/reports/")) {
    throw new Error(`Expected filePath to start with /uploads/reports/, got ${result.filePath}`);
  }

  const diskPath = path.join(process.cwd(), "public", result.filePath.replace(/^\//, ""));
  if (!fs.existsSync(diskPath)) {
    throw new Error(`Expected file to exist on disk at ${diskPath}`);
  }

  // Verify file format on disk is actually WebP by reading buffer
  const savedBuffer = fs.readFileSync(diskPath);
  const meta = await sharp(savedBuffer).metadata();
  if (meta.format !== "webp") {
    throw new Error(`Expected file format on disk to be webp, got ${meta.format}`);
  }

  // Cleanup test file
  fs.unlinkSync(diskPath);

  console.log("All evidence-image tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
