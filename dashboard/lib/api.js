// Server-side (SSR): use internal Docker URL + API key
// Client-side (browser): use relative /api through Nginx
const API_BASE =
  process.env.INTERNAL_API_URL ||          // server-side: http://backend:3001/api
  process.env.NEXT_PUBLIC_API_URL ||       // client-side override
  'http://localhost:3001/api';             // local dev fallback

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'outreach-internal-key';

/**
 * Fetch wrapper for backend API (server-side).
 * Automatically includes internal API key for auth.
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': INTERNAL_API_KEY,
      ...options.headers,
    },
    cache: 'no-store',
    ...options,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Client-side API base for use in 'use client' components.
 */
export const CLIENT_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || '/api';

export const CLIENT_API_KEY = INTERNAL_API_KEY;
