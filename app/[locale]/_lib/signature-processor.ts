/**
 * Autonomous image processing utilities:
 * 1. compressAvatarPhoto: Zero-config auto compression (< 30 KB WebP).
 * 2. processSignaturePhoto: Zero-config autonomous wet signature extractor.
 *    Auto-removes uneven paper lighting/shadows, removes paper background
 *    to pure transparency, purges edge shadows & dust specks, darkens ink,
 *    and produces a razor-sharp tight trim around the signature strokes.
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
 * - Connected Component Analysis (BFS):
 *   - Automatically detects and erases border shadows (desk / phone edge)
 *   - Automatically erases stray noise/dust specks (< 0.5% of main stroke)
 * - Produces a tight, clean bounding box crop (exact horizontal strip)
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
        for (let y = 0; y < height; y++) {
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

            // Faint lighting / paper grain cutoff
            if (contrast <= 0.13) {
              data[idx + 3] = 0; // Alpha = 0 (Transparent)
            } else {
              // Ink stroke detected: smooth anti-aliased alpha curve
              const alphaNorm = Math.min(
                1,
                Math.pow((contrast - 0.13) / (0.42 - 0.13), 0.85)
              );
              const alpha = Math.round(alphaNorm * 255);

              // Set crisp dark ink color (#0f172a - rich slate black)
              data[idx] = 15;     // R
              data[idx + 1] = 23; // G
              data[idx + 2] = 42; // B
              data[idx + 3] = alpha;
            }
          }
        }

        // 4. Connected Component Analysis (BFS):
        // Detects all isolated islands of ink.
        // Purges edge shadows (at photo borders) and stray dust specks.
        const visited = new Uint8Array(width * height);
        const queueX = new Int32Array(width * height);
        const queueY = new Int32Array(width * height);

        interface ComponentInfo {
          pixelIndices: number[];
          count: number;
          minX: number;
          minY: number;
          maxX: number;
          maxY: number;
          touchesBorder: boolean;
        }

        const components: ComponentInfo[] = [];

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pIdx = y * width + x;
            if (visited[pIdx] || data[pIdx * 4 + 3] === 0) continue;

            let head = 0;
            let tail = 0;
            const pIndices: number[] = [];

            queueX[tail] = x;
            queueY[tail] = y;
            tail++;
            visited[pIdx] = 1;
            pIndices.push(pIdx);

            let cMinX = x;
            let cMaxX = x;
            let cMinY = y;
            let cMaxY = y;

            while (head < tail) {
              const cx = queueX[head];
              const cy = queueY[head];
              head++;

              if (cx < cMinX) cMinX = cx;
              if (cx > cMaxX) cMaxX = cx;
              if (cy < cMinY) cMinY = cy;
              if (cy > cMaxY) cMaxY = cy;

              // Check 8-neighborhood
              for (let dy = -1; dy <= 1; dy++) {
                const ny = cy + dy;
                if (ny < 0 || ny >= height) continue;
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  const nx = cx + dx;
                  if (nx < 0 || nx >= width) continue;

                  const nIdx = ny * width + nx;
                  if (!visited[nIdx] && data[nIdx * 4 + 3] > 0) {
                    visited[nIdx] = 1;
                    queueX[tail] = nx;
                    queueY[tail] = ny;
                    tail++;
                    pIndices.push(nIdx);
                  }
                }
              }
            }

            components.push({
              pixelIndices: pIndices,
              count: tail,
              minX: cMinX,
              minY: cMinY,
              maxX: cMaxX,
              maxY: cMaxY,
              touchesBorder:
                cMinX <= 2 || cMinY <= 2 || cMaxX >= width - 3 || cMaxY >= height - 3,
            });
          }
        }

        // Find the main signature component size
        let maxComponentSize = 0;
        for (const comp of components) {
          if (comp.count > maxComponentSize) {
            maxComponentSize = comp.count;
          }
        }

        // Noise threshold: islands < 0.5% of main stroke (or min 25px) are noise
        const speckThreshold = Math.max(
          25,
          Math.min(100, Math.floor(maxComponentSize * 0.005))
        );

        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let totalInkCount = 0;

        for (const comp of components) {
          // Erase border shadows (e.g. edge of phone camera/table)
          const isBorderShadow =
            comp.touchesBorder && comp.count < maxComponentSize * 0.25;
          const isNoiseSpeck = comp.count < speckThreshold;

          if (isBorderShadow || isNoiseSpeck) {
            for (const pIdx of comp.pixelIndices) {
              data[pIdx * 4 + 3] = 0; // Erase to transparent
            }
          } else {
            // Valid signature stroke
            totalInkCount += comp.count;
            if (comp.minX < minX) minX = comp.minX;
            if (comp.maxX > maxX) maxX = comp.maxX;
            if (comp.minY < minY) minY = comp.minY;
            if (comp.maxY > maxY) maxY = comp.maxY;
          }
        }

        // 5. Validate that actual ink was found
        if (totalInkCount < 40 || minX >= maxX || minY >= maxY) {
          reject(
            new Error(
              "Tanda tangan tidak terdeteksi jelas pada foto. Pastikan tanda tangan di atas kertas putih dan pencahayaan memadai."
            )
          );
          return;
        }

        // 6. Tight bounding box auto-trim with 16px padding
        const padding = 16;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropRight = Math.min(width, maxX + padding + 1);
        const cropBottom = Math.min(height, maxY + padding + 1);
        const cropW = cropRight - cropX;
        const cropH = cropBottom - cropY;

        // Put modified (purged) data back to canvas
        ctx.putImageData(imgData, 0, 0);

        // Create tightly trimmed canvas
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
          inkCount: totalInkCount,
          width: cropW,
          height: cropH,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
