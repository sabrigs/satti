// Cliente da TMDB API (https://developer.themoviedb.org).
// Usa o "API Read Access Token" (v4), que fica somente no servidor.
import { TMDB_READ_TOKEN } from 'astro:env/server';

const BASE_URL = 'https://api.themoviedb.org/3';
const LANGUAGE = 'en-US';

export type MediaType = 'movie' | 'tv';

type QueryValue = string | number | boolean | undefined;

export async function tmdbFetch<T>(
  path: string,
  params: Record<string, QueryValue> = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('language', LANGUAGE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_READ_TOKEN}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB ${response.status} em ${path}`);
  }

  return (await response.json()) as T;
}

export type { QueryValue };
