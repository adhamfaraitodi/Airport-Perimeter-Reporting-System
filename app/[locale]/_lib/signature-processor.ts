/**
 * Autonomous image processing utilities:
 * 1. compressAvatarPhoto: Zero-config auto compression (< 30 KB WebP).
 * 2. processSignaturePhoto: Zero-config autonomous wet signature extractor.
 *    Auto-removes uneven paper lighting/shadows, removes paper background
 *    to pure transparency, darkens ink, and auto-trims whitespace.
 */

export interface ProcessedAvatarResult {
  dataUrl: string;
  sizeBytes: number;
}

export interface ProcessedSignatureResult {
  dataUrl: string;
  inkCount: number;
  width: number;
  height: number;
}

/**
 * Compresses an uploaded avatar to a lightweight WebP (max 320x320 px, ~15-30 KB).
 */
export async function compressAvatarPhoto(
  file: File
): Promise<ProcessedAvatarResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file foto profil"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.onload = () => {
        const maxSize = 320;
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context tidak tersedia"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first (fallback to JPEG 0.85)
        let dataUrl = canvas.toDataURL("image/webp", 0.82);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        }

        // Approximate bytes
        const sizeBytes = Math.round((dataUrl.length * 3) / 4);
        resolve({ dataUrl, sizeBytes });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Autonomous Wet Signature Extractor:
 * - Adapts to non-uniform paper lighting & phone camera shadows
 * - Completely removes paper background (100% transparent alpha)
 * - Anti-aliases ink strokes with crisp dark ink tone
 * - Auto-crops / trims excess surrounding white paper
 */
export async function processSignaturePhoto(
  file: File
): Promise<ProcessedSignatureResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file tanda tangan"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar tanda tangan"));
      img.onload = () => {
        // 1. Constrain initial processing resolution to max 1200px
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("Canvas context tidak tersedia"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 2. Compute local paper background luminance using an adaptive 32x32 grid
        const blockSize = 32;
        const gridCols = Math.ceil(width / blockSize);
        const gridRows = Math.ceil(height / blockSize);
        const localPaperLuma: number[][] = Array.from({ length: gridRows }, () =>
          new Array(gridCols).fill(255)
        );

        for (let gy = 0; gy < gridRows; gy++) {
          for (let gx = 0; gx < gridCols; gx++) {
            const startX = gx * blockSize;
            const startY = gy * blockSize;
            const endX = Math.min(startX + blockSize, width);
            const endY = Math.min(startY + blockSize, height);

            const samples: number[] = [];
            for (let y = startY; y < endY; y += 2) {
              for (let x = startX; x < endX; x += 2) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                // Standard perceptual luminance
                const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                samples.push(luma);
              }
            }

            if (samples.length > 0) {
              samples.sort((a, b) => a - b);
              // Use 90th percentile as representative local paper luminance
              const p90Index = Math.floor(samples.length * 0.9);
              localPaperLuma[gy][gx] = samples[p90Index];
            }
          }
        }

        // 3. Bilinear paper background estimation & contrast separation
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let inkCount = 0;

        for (let y = 0; y < height; y++) {
          // Grid vertical interpolation weight
          const gy = y / blockSize - 0.5;
          const gy0 = Math.max(0, Math.floor(gy));
          const gy1 = Math.min(gridRows - 1, gy0 + 1);
          const wy = Math.max(0, Math.min(1, gy - gy0));

          for (let x = 0; x < width; x++) {
            const gx = x / blockSize - 0.5;
            const gx0 = Math.max(0, Math.floor(gx));
            const gx1 = Math.min(gridCols - 1, gx0 + 1);
            const wx = Math.max(0, Math.min(1, gx - gx0));

            // Bilinear interpolation of local paper luminance
            const top = (1 - wx) * localPaperLuma[gy0][gx0] + wx * localPaperLuma[gy0][gx1];
            const bottom = (1 - wx) * localPaperLuma[gy1][gx0] + wx * localPaperLuma[gy1][gx1];
            const paperLuma = Math.max(1, (1 - wy) * top + wy * bottom);

            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const pxLuma = 0.299 * r + 0.587 * g + 0.114 * b;

            // Relative darkness ratio (contrast against local paper)
            const contrast = (paperLuma - pxLuma) / paperLuma;

            // Low contrast = paper texture / faint lighting -> transparent
            if (contrast <= 0.11) {
              data[idx + 3] = 0; // Alpha = 0 (Transparent)
            } else {
              // Ink stroke detected: smooth anti-aliased alpha curve
              const alphaNorm = Math.min(
                1,
                Math.pow((contrast - 0.11) / (0.42 - 0.11), 0.85)
              );
              const alpha = Math.round(alphaNorm * 255);

              // Set crisp dark ink color (#0f172a - rich slate black)
              data[idx] = 15;     // R
              data[idx + 1] = 23; // G
              data[idx + 2] = 42; // B
              data[idx + 3] = alpha;

              if (alpha > 40) {
                inkCount++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
        }

        // 4. Validate that ink was actually detected
        if (inkCount < 30 || minX >= maxX || minY >= maxY) {
          reject(
            new Error(
              "Tanda tangan tidak terdeteksi jelas pada foto. Pastikan tanda tangan di atas kertas putih dan pencahayaan memadai."
            )
          );
          return;
        }

        // 5. Auto-trim / crop with generous 18px padding
        const padding = 18;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropW = Math.min(width - cropX, maxX - minX + padding * 2);
        const cropH = Math.min(height - cropY, maxY - minY + padding * 2);

        // Put modified data back to canvas
        ctx.putImageData(imgData, 0, 0);

        // Create trimmed canvas
        const trimmedCanvas = document.createElement("canvas");
        trimmedCanvas.width = cropW;
        trimmedCanvas.height = cropH;
        const trimCtx = trimmedCanvas.getContext("2d");
        if (!trimCtx) {
          reject(new Error("Trim canvas context tidak tersedia"));
          return;
        }

        trimCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        const dataUrl = trimmedCanvas.toDataURL("image/png");
        resolve({
          dataUrl,
          inkCount,
          width: cropW,
          height: cropH,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
