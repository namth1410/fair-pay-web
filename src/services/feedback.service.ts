import { APP_VERSION } from '../config/constants';
import { supabase } from '../config/supabase';
import { requireAuthUserId } from './auth.helper';

export const FEEDBACK_MAX_LENGTH = 1000;
export const FEEDBACK_MIN_LENGTH = 3;

const COOLDOWN_KEY = 'fair_pay_feedback_last_sent';
const COOLDOWN_MS = 30_000;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const EXCESS_NEWLINES_RE = /\n{3,}/g;

export function sanitizeFeedback(input: string): string {
  return input.replace(CONTROL_CHARS_RE, '').replace(EXCESS_NEWLINES_RE, '\n\n').trim();
}

export function getFeedbackCooldownRemaining(): number {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(COOLDOWN_KEY);
  } catch {
    return 0;
  }
  if (!raw) return 0;
  const last = Number(raw);
  if (!Number.isFinite(last)) return 0;
  const elapsed = Date.now() - last;
  if (elapsed >= COOLDOWN_MS) return 0;
  return Math.ceil((COOLDOWN_MS - elapsed) / 1000);
}

export async function submitFeedback(message: string): Promise<void> {
  const cleaned = sanitizeFeedback(message);
  if (cleaned.length < FEEDBACK_MIN_LENGTH) {
    throw new Error(`Góp ý quá ngắn (tối thiểu ${FEEDBACK_MIN_LENGTH} ký tự)`);
  }
  if (cleaned.length > FEEDBACK_MAX_LENGTH) {
    throw new Error(`Góp ý quá dài (tối đa ${FEEDBACK_MAX_LENGTH} ký tự)`);
  }
  const remaining = getFeedbackCooldownRemaining();
  if (remaining > 0) {
    throw new Error(`Vui lòng chờ ${remaining}s trước khi gửi góp ý tiếp`);
  }
  const userId = await requireAuthUserId();
  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    message: cleaned,
    app_version: APP_VERSION,
    platform: 'web',
  });
  if (error) throw error;
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
