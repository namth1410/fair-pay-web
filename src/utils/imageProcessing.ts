/**
 * Nén ảnh phía trình duyệt trước khi upload R2 — mirror `compressForUpload` của
 * app: cắt vuông ở giữa (1:1), JPEG, ≤ 2 MB; giảm dần chất lượng rồi kích thước.
 */
const MAX_BYTES = 2 * 1024 * 1024;
const DIMENSION_STEPS = [1600, 1280, 1080, 900, 720];
const QUALITY_STEPS = [0.86, 0.78, 0.7, 0.6, 0.5];

export interface ProcessedImage {
  blob: Blob;
  sizeBytes: number;
  width: number;
  height: number;
  /** object URL để xem trước — nhớ revoke khi bỏ. */
  previewUrl: string;
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // imageOrientation: 'from-image' — xoay đúng theo EXIF (ảnh chụp điện thoại).
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fallback <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Không xử lý được ảnh'))),
      'image/jpeg',
      quality,
    );
  });
}

export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn file ảnh');
  }
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await loadBitmap(file);
  } catch {
    throw new Error('Không đọc được ảnh (định dạng không hỗ trợ). Thử ảnh JPG/PNG khác.');
  }
  const srcW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const side = Math.min(srcW, srcH);
  const sx = Math.round((srcW - side) / 2);
  const sy = Math.round((srcH - side) / 2);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');

  for (const dimStep of DIMENSION_STEPS) {
    const dim = Math.min(dimStep, side);
    canvas.width = dim;
    canvas.height = dim;
    ctx.fillStyle = '#ffffff'; // nền trắng cho PNG trong suốt
    ctx.fillRect(0, 0, dim, dim);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, side, side, 0, 0, dim, dim);
    for (const q of QUALITY_STEPS) {
      const blob = await toBlob(canvas, q);
      if (blob.size <= MAX_BYTES) {
        if ('close' in source) source.close();
        return {
          blob,
          sizeBytes: blob.size,
          width: dim,
          height: dim,
          previewUrl: URL.createObjectURL(blob),
        };
      }
    }
  }
  if ('close' in source) source.close();
  throw new Error('Ảnh không thể nén dưới 2 MB, thử ảnh khác');
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
