import type { APIRoute } from 'astro';

// Converte a coordenada do navegador em código de país (ex.: BR), usado no "On Theater".
// Usa o serviço público do OpenStreetMap (Nominatim), que recebe as coordenadas.
export const GET: APIRoute = async ({ url }) => {
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return new Response(JSON.stringify({ error: 'invalid_coordinates' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const reverse = new URL('https://nominatim.openstreetmap.org/reverse');
  reverse.searchParams.set('format', 'jsonv2');
  reverse.searchParams.set('zoom', '3');
  reverse.searchParams.set('lat', String(lat));
  reverse.searchParams.set('lon', String(lng));

  try {
    const response = await fetch(reverse, {
      headers: { 'User-Agent': 'Aurora/0.0.1 (internal app)', Accept: 'application/json' },
    });
    const data = (await response.json()) as { address?: { country_code?: string } };
    const region = data.address?.country_code?.toUpperCase() ?? null;

    return new Response(JSON.stringify({ region }), {
      status: region ? 200 : 404,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'upstream_error' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
