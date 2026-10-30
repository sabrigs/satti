import type { APIRoute } from 'astro';
import { getTitleStreamingProviders } from '../../../../../lib/streaming/availability';
import type { MediaType } from '../../../../../lib/tmdb/client';

// Marcas de streaming onde o título está disponível (usado pelo filtro de streaming das listas).
export const GET: APIRoute = async ({ params }) => {
  const mediaType = params.mediaType;
  const id = Number(params.id);

  if ((mediaType !== 'movie' && mediaType !== 'tv') || !Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: 'invalid_title' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const providers = await getTitleStreamingProviders(mediaType as MediaType, id).catch(() => []);

  return new Response(JSON.stringify({ brands: providers.map((provider) => provider.name) }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, max-age=3600',
    },
  });
};
