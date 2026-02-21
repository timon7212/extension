// Server-side (SSR in Docker): use internal Docker network URL
// Client-side (browser): use relative /api which goes through Nginx
const API_BASE =
  process.env.INTERNAL_API_URL ||          // server-side: http://backend:3001/api
  process.env.NEXT_PUBLIC_API_URL ||       // client-side: /api
  'http://localhost:3001/api';             // local dev fallback

/**
 * Fetch wrapper for backend API.
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
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
