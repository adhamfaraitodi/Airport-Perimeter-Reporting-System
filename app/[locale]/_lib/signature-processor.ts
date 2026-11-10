/**
 * Autonomous image processing utilities:
 * compressAvatarPhoto: Zero-config auto compression (< 30 KB WebP).
 */

export interface ProcessedAvatarResult {
  dataUrl: string;
  sizeBytes: number;
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
