import { SUPABASE_ANON_KEY } from '../config/constants';
import { supabase } from '../config/supabase';

/**
 * Gọi Supabase Edge Function QUA PROXY CÙNG ORIGIN (`/sb-fn/<name>`).
 *
 * Lý do không gọi thẳng `https://<ref>.supabase.co/functions/v1/...` từ trình
 * duyệt: preflight OPTIONS của các function hiện trả 500 (helper CORS dựng
 * Response 204 kèm body) → trình duyệt chặn. Proxy cùng origin (nginx ở prod,
 * Vite dev server ở local) thì không cần CORS, KHÔNG phải sửa/redeploy function
 * đang dùng chung với app Android.
 */
const FN_BASE = '/sb-fn';

interface FunctionErrorBody {
  error?: string;
  retryAfter?: number;
}

export async function invokeEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Chưa đăng nhập');

  let res: Response;
  try {
    res = await fetch(`${FN_BASE}/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Không có kết nối mạng');
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const errBody = (parsed ?? {}) as FunctionErrorBody;
    const err = new Error(errBody.error || `Lỗi máy chủ (${res.status})`) as Error & {
      retryAfter?: number;
    };
    if (errBody.retryAfter) err.retryAfter = errBody.retryAfter;
    throw err;
  }
  return parsed as T;
}

/**
 * PUT ảnh lên R2 bằng presigned URL — cũng đi qua proxy cùng origin (`/r2-put/…`)
 * vì bucket R2 chưa bật CORS. Chữ ký SigV4 gắn host + path + query + content-type +
 * content-length; proxy giữ nguyên path/query và đặt lại Host = endpoint R2 nên
 * chữ ký vẫn hợp lệ.
 */
export async function uploadToPresignedUrl(uploadUrl: string, blob: Blob): Promise<void> {
  const url = new URL(uploadUrl);
  const host = url.hostname; // <account>.r2.cloudflarestorage.com
  if (!host.endsWith('.r2.cloudflarestorage.com')) {
    throw new Error('URL upload không hợp lệ');
  }
  const proxied = `/r2-put${url.pathname}${url.search}`;
  let res: Response;
  try {
    res = await fetch(proxied, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });
  } catch {
    throw new Error('Không có kết nối mạng');
  }
  if (!res.ok) {
    throw new Error(`Tải ảnh lên thất bại (${res.status})`);
  }
}
