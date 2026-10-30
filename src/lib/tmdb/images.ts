// URLs de imagens da TMDB (pôsteres e backdrops).
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const posterUrl = (path: string | null, size = 'w342') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;

export const logoUrl = (path: string | null, size = 'w92') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;
