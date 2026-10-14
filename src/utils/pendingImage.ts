import type { ProcessedImage } from './imageProcessing';

/**
 * Ảnh chọn ở QuickAddSheet → chuyển sang trang Thêm khoản chi. Blob không đi
 * qua URL được nên giữ tạm ở module (1 ảnh tại 1 thời điểm).
 */
let pending: ProcessedImage | null = null;

export function setPendingImage(img: ProcessedImage | null): void {
  if (pending && pending !== img) URL.revokeObjectURL(pending.previewUrl);
  pending = img;
}

/** Lấy và xóa khỏi hàng chờ (quyền sở hữu chuyển sang form). */
export function takePendingImage(): ProcessedImage | null {
  const img = pending;
  pending = null;
  return img;
}
