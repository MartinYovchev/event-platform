import 'server-only';
import { ApiError, parseErrorBody } from '@/lib/errors';
import { getSessionToken } from './session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8081';

type ServerFetchInit = RequestInit & {
  auth?: boolean;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

export async function serverFetch<T>(path: string, init: ServerFetchInit = {}): Promise<T> {
  const { auth = true, cache = 'no-store', next, headers: initHeaders, body, ...rest } = init;

  const headers = new Headers(initHeaders);
  if (body !== undefined && body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  if (auth !== false) {
    const token = await getSessionToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const requestInit: RequestInit & { next?: NextFetchRequestConfig } = {
    ...rest,
    headers,
    body: body as BodyInit | null | undefined,
    cache,
  };
  if (next) requestInit.next = next;

  const res = await fetch(`${BACKEND_URL}${path}`, requestInit);

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorBody(res));
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
