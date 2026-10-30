import type { APIRoute } from 'astro';
import { getTitleDetails } from '../../../../../lib/tmdb/titles';
import type { MediaType } from '../../../../../lib/tmdb/client';

// Dados resumidos de um título para os cards (backdrop, pôster e nota). Cacheado pela TMDB client.
export const GET: APIRoute = async ({ params }) => {
  const mediaType = params.mediaType;
  const id = Number(params.id);

  if ((mediaType !== 'movie' && mediaType !== 'tv') || !Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: 'invalid_title' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const details = await getTitleDetails(mediaType as MediaType, id);
    return new Response(
      JSON.stringify({
        backdropPath: details.backdropPath,
        posterPath: details.posterPath,
        voteAverage: details.voteAverage,
      }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'private, max-age=600',
        },
      },
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'upstream_error' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
