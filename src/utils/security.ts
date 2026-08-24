import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';

/**
 * Frontend XSS Sanitization for Chat & Profiles
 * Strips out dangerous HTML tags and scripts from raw input strings.
 */
export function sanitizeUserInput(rawString: string, allowBasicHtml = false): string {
  if (!rawString) return '';
  if (allowBasicHtml) {
    return DOMPurify.sanitize(rawString, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span'],
      ALLOWED_ATTR: ['href', 'target', 'class', 'rel']
    });
  }
  return DOMPurify.sanitize(rawString, {
    ALLOWED_TAGS: [], // Disallow HTML tags entirely for plain text
    ALLOWED_ATTR: []
  });
}

// In-memory rate limiting map for client-side rapid click & request throttling
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

/**
 * Client-Side Action Rate Limiter Guard
 * @param actionKey Unique identifier for the action (e.g. 'send_msg', 'release_escrow')
 * @param maxRequests Maximum allowed triggers within the window
 * @param windowMs Time window in milliseconds
 * @returns boolean True if action is ALLOWED, False if RATE LIMITED
 */
export function checkClientRateLimit(
  actionKey: string,
  maxRequests = 5,
  windowMs = 5000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(actionKey);

  if (!entry) {
    rateLimitMap.set(actionKey, { count: 1, lastReset: now });
    return true;
  }

  if (now - entry.lastReset > windowMs) {
    rateLimitMap.set(actionKey, { count: 1, lastReset: now });
    return true;
  }

  if (entry.count < maxRequests) {
    entry.count += 1;
    return true;
  }

  return false;
}

/**
 * Call Supabase Database Rate Limiter Function `check_rate_limit`
 */
export async function checkDatabaseRateLimit(
  userId: string,
  action: string,
  maxRequests = 10,
  windowSeconds = 60
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_action: action,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      // If RPC is not present in local sandbox, fallback to client-side check
      console.warn('Supabase rate_limit RPC notice (using fallback guard):', error.message);
      return checkClientRateLimit(`${userId}:${action}`, maxRequests, windowSeconds * 1000);
    }

    return Boolean(data);
  } catch {
    return checkClientRateLimit(`${userId}:${action}`, maxRequests, windowSeconds * 1000);
  }
}
