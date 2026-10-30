// Cliente da TMDB API (https://developer.themoviedb.org).
// Usa o "API Read Access Token" (v4), que fica somente no servidor.
import { TMDB_READ_TOKEN } from 'astro:env/server';

const BASE_URL = 'https://api.themoviedb.org/3';
const LANGUAGE = 'en-US';

export type MediaType = 'movie' | 'tv';

type QueryValue = string | number | boolean | undefined;

// Cache em memória das respostas da TMDB. Dados de catálogo mudam devagar, então
// páginas repetidas e chamadas simultâneas reaproveitam a mesma resposta.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

async function request<T>(url: URL, path: string): Promise<T> {
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

  const key = url.toString();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value as Promise<T>;
  }

  const value = request<T>(url, path);
  cache.delete(key);
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  if (cache.size > CACHE_MAX_ENTRIES) {
    // Remove a entrada mais antiga (o Map mantém a ordem de inserção).
    cache.delete(cache.keys().next().value as string);
  }

  // Erro não fica em cache: a próxima chamada tenta de novo.
  value.catch(() => cache.delete(key));
  return value;
}

export type { QueryValue };
