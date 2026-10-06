import { API_BASE_URL } from '../../api.js';

export async function mentorRequest(path: string, options: RequestInit = {}) {
  const token = sessionStorage.getItem('access_token');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail;
    throw new Error(typeof detail === 'string' ? detail : 'Request failed');
  }
  return data;
}
