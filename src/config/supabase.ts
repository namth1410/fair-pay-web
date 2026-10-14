import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './constants';

/**
 * Web client: session lưu localStorage (mặc định của supabase-js) và tự refresh
 * theo visibility của tab. `detectSessionInUrl` BẬT để link đặt lại mật khẩu
 * (`/reset-password#access_token=…` hoặc `?code=…`) tự đổi thành session.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'fairpay-web-auth',
  },
});
