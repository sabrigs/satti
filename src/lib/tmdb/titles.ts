// Consultas de filmes e séries usadas pelas telas (Explore, detalhes, backdrop).
import { tmdbFetch, type MediaType } from './client';

export interface TitleSummary {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  voteAverage: number;
}

export interface TitlePage {
  items: TitleSummary[];
  totalPages: number;
}

interface RawTitle {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
}

interface RawPerson {
  id: number;
  media_type?: string;
  known_for?: RawTitle[];
}

interface Paged<T> {
  page: number;
  total_pages: number;
  results: T[];
}

const MAX_PAGES = 500; // limite da TMDB API

const isTitleType = (value: string | undefined): value is MediaType => value === 'movie' || value === 'tv';

const toSummary = (raw: RawTitle, mediaType: MediaType): TitleSummary => ({
  id: raw.id,
  mediaType,
  title: raw.title ?? raw.name ?? '',
  posterPath: raw.poster_path,
  backdropPath: raw.backdrop_path,
  overview: raw.overview,
  voteAverage: raw.vote_average,
});

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

// Explore → "Trending": títulos em alta na última semana.
export async function getTrending(page = 1): Promise<TitlePage> {
  const data = await tmdbFetch<Paged<RawTitle & { media_type?: string }>>('/trending/all/week', { page });
  return {
    items: data.results
      .filter((item) => isTitleType(item.media_type))
      .map((item) => toSummary(item, item.media_type as MediaType)),
    totalPages: Math.min(data.total_pages, MAX_PAGES),
  };
}

// Explore → "On Theater": filmes em cartaz na região do usuário (código ISO, ex.: BR).
export async function getOnTheater(region: string, page = 1): Promise<TitlePage> {
  const data = await tmdbFetch<Paged<RawTitle>>('/movie/now_playing', { page, region });
  return {
    items: data.results.map((item) => toSummary(item, 'movie')),
    totalPages: Math.min(data.total_pages, MAX_PAGES),
  };
}

// Filmes em cartaz no Brasil, usado para marcar "In theaters" nos detalhes.
// Lê as páginas de now_playing (mesma fonte da aba On Theater), com cache de 1 hora.
const THEATER_CACHE_MS = 60 * 60 * 1000;
let theaterCache: { ids: Set<number>; expires: number } | null = null;

async function getBrazilTheaterIds(): Promise<Set<number>> {
  if (theaterCache && theaterCache.expires > Date.now()) {
    return theaterCache.ids;
  }

  const first = await tmdbFetch<Paged<RawTitle>>('/movie/now_playing', { page: 1, region: 'BR' });
  const ids = new Set(first.results.map((item) => item.id));
  const pages = Math.min(first.total_pages, 10);
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      tmdbFetch<Paged<RawTitle>>('/movie/now_playing', { page: index + 2, region: 'BR' }),
    ),
  );
  rest.forEach((data) => data.results.forEach((item) => ids.add(item.id)));

  theaterCache = { ids, expires: Date.now() + THEATER_CACHE_MS };
  return ids;
}

export async function isInBrazilTheaters(mediaType: MediaType, id: number): Promise<boolean> {
  if (mediaType !== 'movie') return false;
  return (await getBrazilTheaterIds()).has(id);
}

// Busca por título ou artista. Para artistas, entram os títulos conhecidos deles (known_for).
export async function searchTitles(query: string, page = 1): Promise<TitlePage> {
  const data = await tmdbFetch<Paged<RawTitle & RawPerson>>('/search/multi', {
    query,
    page,
    include_adult: false,
  });

  const items: TitleSummary[] = [];
  for (const result of data.results) {
    if (isTitleType(result.media_type)) {
      items.push(toSummary(result, result.media_type));
    } else if (result.media_type === 'person') {
      for (const known of result.known_for ?? []) {
        if (isTitleType(known.media_type)) {
          items.push(toSummary(known, known.media_type));
        }
      }
    }
  }

  // Remove duplicados (um título pode aparecer por mais de um artista).
  const unique = new Map(items.map((item) => [`${item.mediaType}:${item.id}`, item]));
  return {
    items: [...unique.values()],
    totalPages: Math.min(data.total_pages, MAX_PAGES),
  };
}

export interface TitleDetails extends TitleSummary {
  genres: string[];
  runtime: number | null;
  imdbId: string | null;
  cast: { name: string; character: string }[];
}

interface RawDetails extends RawTitle {
  genres: { name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  imdb_id?: string | null;
  external_ids?: { imdb_id: string | null };
  credits?: { cast: { name: string; character: string }[] };
}

// Detalhes do título (Lista de metadados, sinopse e elenco).
export async function getTitleDetails(mediaType: MediaType, id: number): Promise<TitleDetails> {
  const raw = await tmdbFetch<RawDetails>(`/${mediaType}/${id}`, {
    append_to_response: 'credits,external_ids',
  });

  return {
    ...toSummary(raw, mediaType),
    genres: raw.genres.map((genre) => genre.name),
    runtime: raw.runtime ?? raw.episode_run_time?.[0] ?? null,
    imdbId: raw.external_ids?.imdb_id ?? raw.imdb_id ?? null,
    cast: (raw.credits?.cast ?? []).slice(0, 10).map((member) => ({
      name: member.name,
      character: member.character,
    })),
  };
}

// Backdrop aleatório para o login: escolhe um título da tendência semanal.
export async function getRandomBackdrop(): Promise<string | null> {
  const { items } = await getTrending();
  const titles = items.filter((item) => item.backdropPath);
  if (titles.length === 0) {
    return null;
  }
  const pick = titles[Math.floor(Math.random() * titles.length)];
  return pick.backdropPath;
}
